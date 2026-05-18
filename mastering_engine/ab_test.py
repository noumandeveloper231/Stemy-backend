"""
ab_test.py – A/B testing hooks for comparing preset changes.

Usage:
    python ab_test.py test_sweep          # Run A/B on all genres with test file
    python ab_test.py compare <genre>    # Compare current vs reference for one genre

The DSP engineer can use this to verify changes don't regress audio quality.
"""

from __future__ import annotations

import io
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from dsp_chain import master_audio, _lufs, _true_peak_db, _dynamic_range

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s"
)
log = logging.getLogger(__name__)

# Test signal: 1kHz sine + pink noise burst (simulates music)
def generate_test_signal(duration_sec: float = 10.0, sr: int = 44100) -> np.ndarray:
    """Generate a test signal for A/B testing (1kHz tone + noise burst)."""
    n_samples = int(duration_sec * sr)
    t = np.arange(n_samples) / sr
    
    # 1kHz sine wave
    tone = 0.3 * np.sin(2 * np.pi * 1000 * t)
    
    # Pink noise burst (simulates drums/percussion)
    noise = np.random.randn(n_samples) * 0.15
    # Apply envelope: fade in/out
    envelope = np.exp(-((t - duration_sec/2) ** 2) / (2 * (duration_sec/4) ** 2))
    noise = noise * envelope
    
    # Stereo
    audio = np.stack([tone + noise, tone * 0.9 + noise * 1.1], axis=-1)
    return audio.astype(np.float32)


def analyze_audio(audio: np.ndarray, sr: int = 44100) -> dict[str, Any]:
    """Run full audio analysis on a signal."""
    return {
        "lufs": round(_lufs(audio, sr), 1),
        "dbtp": round(_true_peak_db(audio), 2),
        "dr": round(_dynamic_range(audio), 1),
        "duration": round(len(audio) / sr, 2),
    }


def run_ab_test(
    audio_bytes: bytes,
    genre_a: str,
    genre_b: str | None = None,
) -> dict[str, Any]:
    """
    Run A/B comparison between two presets.
    
    Parameters
    ----------
    audio_bytes   : raw audio file bytes to process
    genre_a       : primary genre preset to test
    genre_b       : secondary genre for comparison (optional)
    
    Returns
    -------
    dict with 'a' and optionally 'b' keys containing analysis results
    """
    if genre_b is None:
        # Compare against same genre (for before/after code changes)
        genre_b = genre_a
    
    log.info(f"Running A/B test: {genre_a} vs {genre_b}")
    
    # Process with genre A
    wav_a, analysis_a = master_audio(audio_bytes, genre_a)
    
    # Process with genre B
    wav_b, analysis_b = master_audio(audio_bytes, genre_b)
    
    # Compare results
    comparison = {
        "a": {
            "genre": genre_a,
            "analysis": analysis_a,
        },
        "b": {
            "genre": genre_b,
            "analysis": analysis_b,
        },
        "diff": {
            "lufs_diff": round(analysis_a["lufs"] - analysis_b["lufs"], 1),
            "dbtp_diff": round(analysis_a["dbtp"] - analysis_b["dbtp"], 2),
            "dr_diff": round(analysis_a["dr"] - analysis_b["dr"], 1),
        }
    }
    
    return comparison


def run_sweep(audio_bytes: bytes) -> dict[str, Any]:
    """Run all genre presets on a test signal and return comparison data."""
    from presets import GENRES
    
    results = {}
    baseline = None
    
    for genre in GENRES.keys():
        wav_bytes, analysis = master_audio(audio_bytes, genre)
        results[genre] = analysis
        
        if baseline is None:
            baseline = analysis
            baseline_genre = genre
    
    # Calculate differences from baseline
    sweep = {
        "baseline_genre": baseline_genre,
        "genres": {},
    }
    
    for genre, analysis in results.items():
        sweep["genres"][genre] = {
            "lufs": analysis["lufs"],
            "dbtp": analysis["dbtp"],
            "dr": analysis["dr"],
            "duration": analysis["duration"],
            "diff_from_baseline": {
                "lufs": round(analysis["lufs"] - baseline["lufs"], 1),
                "dbtp": round(analysis["dbtp"] - baseline["dbtp"], 2),
                "dr": round(analysis["dr"] - baseline["dr"], 1),
            }
        }
    
    return sweep


def save_reference(audio_bytes: bytes, genre: str, output_path: str = "reference.wav") -> None:
    """Save a reference master for future comparison."""
    wav_bytes, _ = master_audio(audio_bytes, genre)
    Path(output_path).write_bytes(wav_bytes)
    log.info(f"Saved reference: {output_path}")


def compare_with_reference(audio_bytes: bytes, genre: str, reference_path: str) -> dict:
    """Compare current output against a saved reference file."""
    # Get current analysis
    _, current = master_audio(audio_bytes, genre)
    
    # Load reference
    ref_audio, sr = sf.read(reference_path)
    ref_analysis = analyze_audio(ref_audio, sr)
    
    return {
        "current": current,
        "reference": ref_analysis,
        "diff": {
            "lufs": round(current["lufs"] - ref_analysis["lufs"], 1),
            "dbtp": round(current["dbtp"] - ref_analysis["dbtp"], 2),
            "dr": round(current["dr"] - ref_analysis["dr"], 1),
        }
    }


def save_test_signal(path: str = "test_signal.wav") -> bytes:
    """Generate and save a test signal, return bytes."""
    audio = generate_test_signal(duration_sec=10.0)
    buf = io.BytesIO()
    sf.write(buf, audio, 44100, format="WAV", subtype="PCM_16")
    wav_bytes = buf.getvalue()
    Path(path).write_bytes(wav_bytes)
    log.info(f"Saved test signal: {path}")
    return wav_bytes


# ─── CLI entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "test_sweep":
        # Generate test signal and run sweep
        test_bytes = save_test_signal("test_signal.wav")
        results = run_sweep(test_bytes)
        print(json.dumps(results, indent=2))
        
    elif cmd == "compare":
        genre = sys.argv[2] if len(sys.argv) > 2 else "pop"
        test_bytes = save_test_signal("test_signal.wav")
        
        # Run A/B with same genre (for before/after comparison)
        result = run_ab_test(test_bytes, genre, genre)
        print(json.dumps(result, indent=2))
        
    elif cmd == "save_ref":
        genre = sys.argv[2] if len(sys.argv) > 2 else "pop"
        test_bytes = save_test_signal("test_signal.wav")
        save_reference(test_bytes, genre, f"reference_{genre}.wav")
        
    elif cmd == "check_ref":
        genre = sys.argv[2] if len(sys.argv) > 2 else "pop"
        test_bytes = save_test_signal("test_signal.wav")
        result = compare_with_reference(test_bytes, genre, f"reference_{genre}.wav")
        print(json.dumps(result, indent=2))
        
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)