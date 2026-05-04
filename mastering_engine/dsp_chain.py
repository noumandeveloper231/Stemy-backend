"""
dsp_chain.py – Server-side mastering DSP using pedalboard + pyloudnorm.

Full chain (matches the frontend Web Audio graph):
  1. High-Pass Filter        (removes sub-sonic rumble)
  2. 4-Band EQ               (LowShelf · MidDip · Presence · AirShelf)
  3. Saturation              (soft-clip harmonic warmth)
  4. Bus Compressor          (glue / dynamics control)
  5. Stereo Widener          (Mid/Side width expansion)
  6. Brickwall Limiter       (true-peak ceiling at -1 dBTP)
  7. LUFS normalisation      (integrated target: -14 LUFS, streaming standard)

Output spec:
  • Sample rate : 44 100 Hz
  • Bit depth   : 24-bit PCM WAV
  • Integrated  : -14 LUFS  (±0.3 LU tolerance)
  • True peak   : -1.0 dBTP (hard ceiling)
"""

from __future__ import annotations

import io
import logging
import warnings
from pathlib import Path

import numpy as np
import soundfile as sf
import pyloudnorm as pyln

# Suppress noisy pedalboard resampling warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pedalboard")

try:
    from pedalboard import (
        Pedalboard,
        HighpassFilter,
        LowShelfFilter,
        PeakFilter,
        HighShelfFilter,
        Compressor,
        Limiter,
    )
    PEDALBOARD_AVAILABLE = True
except ImportError as e:
    PEDALBOARD_AVAILABLE = False
    _PEDALBOARD_ERROR = str(e)

from genres import get_preset, DEFAULT_GENRE

log = logging.getLogger(__name__)

# ─────────────────────────── constants ──────────────────────────────────────
TARGET_SR       = 44_100          # output sample rate (Hz)
TARGET_BITS     = 24              # output bit depth
TARGET_LUFS     = -14.0          # integrated loudness target
TARGET_TP_DB    = -1.0           # true-peak ceiling (dBTP)
MAX_GAIN_DB     = 30.0           # safety: never boost by more than this

# How many passes of limiter-normalise to run (usually 1-2 is enough)
NORM_PASSES     = 2


# ─────────────────────────── helpers ────────────────────────────────────────

def _db_to_lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def _lin_to_db(lin: float) -> float:
    if lin <= 0:
        return -120.0
    return 20.0 * np.log10(lin)


def _ensure_stereo(audio: np.ndarray) -> np.ndarray:
    """Return (N, 2) float32 array regardless of input channel count."""
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=-1)
    elif audio.shape[1] == 1:
        audio = np.concatenate([audio, audio], axis=-1)
    elif audio.shape[1] > 2:
        audio = audio[:, :2]          # take first two channels
    return audio.astype(np.float32)


def _true_peak_db(audio: np.ndarray) -> float:
    """Approximate true-peak via 4× oversampled envelope."""
    from scipy.signal import resample_poly
    up = resample_poly(audio, 4, 1, axis=0).astype(np.float32)
    return _lin_to_db(float(np.max(np.abs(up))))


def _lufs(audio: np.ndarray, sr: int) -> float:
    """BS.1770-3 integrated loudness in LUFS."""
    meter = pyln.Meter(sr)
    return meter.integrated_loudness(audio.astype(np.float64))


# ─────────────────────────── Mid/Side widener ───────────────────────────────

def _ms_widen(audio: np.ndarray, width: float) -> np.ndarray:
    """
    Mid/Side stereo widener.
    width = 1.0 → no change
    width = 1.5 → 50% wider side channel
    width = 2.0 → double the side channel (very wide)

    Keeps overall level constant by normalising against original RMS.
    """
    if width <= 0 or abs(width - 1.0) < 1e-3:
        return audio

    L = audio[:, 0]
    R = audio[:, 1]

    mid  = (L + R) * 0.5
    side = (L - R) * 0.5

    # Scale the side signal
    side_scaled = side * width

    # Recombine
    L_out = mid + side_scaled
    R_out = mid - side_scaled

    out = np.stack([L_out, R_out], axis=-1)

    # Loudness-preserve: match RMS of input
    rms_in  = float(np.sqrt(np.mean(audio ** 2))) + 1e-9
    rms_out = float(np.sqrt(np.mean(out  ** 2))) + 1e-9
    out = out * (rms_in / rms_out)

    return out.astype(np.float32)


# ─────────────────────────── soft-clip saturation ───────────────────────────

def _soft_clip_saturation(audio: np.ndarray, drive: float) -> np.ndarray:
    """
    Mastering-grade soft-clip saturation.
    Mirrors the Web Audio WaveShaper in main.js:
        shaped = x - (k/3) * x³    (soft cubic)
        output = tanh(shaped * 1.1) / tanh(1.1)

    drive: 0.0 = bypass, 1.0 = heavy saturation
    For mastering use 0.05-0.4; values in genre presets are already sane.
    """
    k = float(np.clip(drive, 0.0, 1.5))
    if k < 1e-4:
        return audio

    # Pre-gain to push into the curve
    pre  = audio * (1.0 + k * 0.5)
    shaped = pre - (k / 3.0) * pre ** 3

    # tanh soft-clip to prevent overshoot
    normaliser = float(np.tanh(1.1))
    out = np.tanh(shaped * 1.1) / normaliser

    # Compensate output level (saturation adds apparent loudness)
    rms_in  = float(np.sqrt(np.mean(audio ** 2))) + 1e-9
    rms_out = float(np.sqrt(np.mean(out   ** 2))) + 1e-9
    out = out * (rms_in / rms_out)

    return out.astype(np.float32)


# ─────────────────────────── main mastering function ────────────────────────

def master_audio(
    input_bytes: bytes,
    genre: str = DEFAULT_GENRE,
    *,
    target_lufs: float = TARGET_LUFS,
    target_tp_db: float = TARGET_TP_DB,
) -> bytes:
    """
    Master an audio file and return 44.1 kHz / 24-bit WAV bytes.

    Parameters
    ----------
    input_bytes  : raw audio file bytes (any format soundfile can decode)
    genre        : genre key string (e.g. "pop", "hiphop", "rnb")
    target_lufs  : integrated LUFS target (default -14.0)
    target_tp_db : true-peak ceiling in dBTP (default -1.0)

    Returns
    -------
    bytes : 24-bit PCM WAV at 44100 Hz, stereo
    """
    if not PEDALBOARD_AVAILABLE:
        raise RuntimeError(
            f"pedalboard is not installed: {_PEDALBOARD_ERROR}. "
            "Run: pip install pedalboard"
        )

    preset = get_preset(genre)
    # Allow preset to override global loudness targets
    target_lufs  = preset.get("target_lufs",  target_lufs)
    target_tp_db = preset.get("target_tp_db", target_tp_db)

    log.info("Mastering — genre=%s target_lufs=%.1f target_tp=%.1f",
             genre, target_lufs, target_tp_db)

    # ── 1. Load input audio ─────────────────────────────────────────────────
    with io.BytesIO(input_bytes) as buf:
        audio_raw, src_sr = sf.read(buf, dtype="float32", always_2d=True)

    audio = _ensure_stereo(audio_raw)
    log.info("Input: %d samples @ %d Hz, %.2f s, true-peak=%.1f dBFS",
             len(audio), src_sr, len(audio) / src_sr, _true_peak_db(audio))

    # ── 2. Resample to 44 100 Hz if necessary ───────────────────────────────
    if src_sr != TARGET_SR:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(src_sr, TARGET_SR)
        audio = resample_poly(audio, TARGET_SR // g, src_sr // g, axis=0)
        audio = audio.astype(np.float32)
        log.info("Resampled %d → %d Hz", src_sr, TARGET_SR)

    sr = TARGET_SR

    # ── 3. Build pedalboard EQ + compressor + limiter chain ─────────────────
    p = preset
    comp_cfg = p["comp"]

    board = Pedalboard([
        # HPF – remove sub-sonic rumble & DC offset
        HighpassFilter(cutoff_frequency_hz=p["hpf_hz"]),

        # 4-Band EQ
        LowShelfFilter(
            cutoff_frequency_hz=p["low_shelf"]["freq_hz"],
            gain_db=p["low_shelf"]["gain_db"],
        ),
        PeakFilter(
            cutoff_frequency_hz=p["mid_dip"]["freq_hz"],
            gain_db=p["mid_dip"]["gain_db"],
            q=p["mid_dip"]["q"],
        ),
        PeakFilter(
            cutoff_frequency_hz=p["presence"]["freq_hz"],
            gain_db=p["presence"]["gain_db"],
            q=p["presence"]["q"],
        ),
        HighShelfFilter(
            cutoff_frequency_hz=p["air_shelf"]["freq_hz"],
            gain_db=p["air_shelf"]["gain_db"],
        ),

        # Bus Compressor (glue)
        # Note: pedalboard Compressor does not expose knee_db — it uses
        # a fixed soft-knee internally. knee_db from presets is ignored here.
        Compressor(
            threshold_db=comp_cfg["threshold_db"],
            ratio=comp_cfg["ratio"],
            attack_ms=comp_cfg["attack_ms"],
            release_ms=comp_cfg["release_ms"],
        ),
    ])

    # pedalboard expects (channels, samples) layout
    audio_pb = audio.T  # (2, N)
    audio_pb = board.process(audio_pb, sample_rate=sr)
    audio = audio_pb.T  # back to (N, 2)

    # Makeup gain after compressor
    makeup_db  = comp_cfg.get("makeup_db", 0.0)
    audio = audio * _db_to_lin(makeup_db)

    # ── 4. Saturation ────────────────────────────────────────────────────────
    audio = _soft_clip_saturation(audio, p["saturation_drive"])

    # ── 5. Stereo widener (Mid/Side) ─────────────────────────────────────────
    audio = _ms_widen(audio, p.get("width", 1.0))

    # ── 6. LUFS normalisation + brickwall limiter (up to N passes) ───────────
    lim_cfg = p["limiter"]
    limiter = Pedalboard([
        Limiter(
            threshold_db=lim_cfg["threshold_db"],
            release_ms=lim_cfg["release_ms"],
        )
    ])

    for pass_num in range(1, NORM_PASSES + 2):    # allow one extra safety pass
        measured_lufs = _lufs(audio, sr)

        if not np.isfinite(measured_lufs) or measured_lufs < -70:
            log.warning("LUFS measurement returned %.1f – audio may be silent", measured_lufs)
            break

        gain_needed = target_lufs - measured_lufs
        gain_needed = float(np.clip(gain_needed, -MAX_GAIN_DB, MAX_GAIN_DB))
        log.info("Pass %d: measured=%.2f LUFS, applying %.2f dB gain",
                 pass_num, measured_lufs, gain_needed)

        audio = audio * _db_to_lin(gain_needed)

        # Apply limiter
        audio_pb = audio.T
        audio_pb = limiter.process(audio_pb, sample_rate=sr)
        audio = audio_pb.T

        # Check true-peak compliance
        tp = _true_peak_db(audio)
        log.info("Pass %d: true-peak=%.2f dBTP", pass_num, tp)

        if tp > target_tp_db + 0.1:
            # Attenuate to meet true-peak ceiling, then loop again
            excess = tp - target_tp_db
            audio  = audio * _db_to_lin(-excess - 0.05)   # slight extra margin
            log.info("True-peak exceeded by %.2f dB – attenuating & re-limiting", excess)
        else:
            log.info("True-peak OK (%.2f dBTP ≤ %.2f) – done.", tp, target_tp_db)
            break

    # ── 7. Final true-peak hard ceiling (safety net) ─────────────────────────
    hard_ceil = _db_to_lin(target_tp_db - 0.05)
    peak      = float(np.max(np.abs(audio)))
    if peak > hard_ceil:
        audio = audio * (hard_ceil / peak)
        log.info("Hard ceiling applied (peak was %.4f)", peak)

    # ── 8. Verify final stats ─────────────────────────────────────────────────
    final_lufs = _lufs(audio, sr)
    final_tp   = _true_peak_db(audio)
    log.info("Final: %.2f LUFS, %.2f dBTP", final_lufs, final_tp)

    # ── 9. Encode to 24-bit PCM WAV ──────────────────────────────────────────
    out_buf = io.BytesIO()
    sf.write(out_buf, audio.astype(np.float32), sr,
             format="WAV", subtype="PCM_24")
    out_buf.seek(0)
    return out_buf.read()


# ─────────────────────────── quick self-test ────────────────────────────────
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s %(message)s")

    if len(sys.argv) < 2:
        print("Usage: python dsp_chain.py <input_audio> [genre] [output.wav]")
        sys.exit(1)

    src  = Path(sys.argv[1])
    genre = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_GENRE
    dest = Path(sys.argv[3]) if len(sys.argv) > 3 else src.with_stem(src.stem + "_mastered")

    raw = src.read_bytes()
    out = master_audio(raw, genre)
    dest.write_bytes(out)
    print(f"✓ Mastered → {dest}  ({len(out)//1024} KB)")
