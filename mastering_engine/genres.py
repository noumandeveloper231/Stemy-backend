"""
Genre presets for the Stemy mastering engine.
Each preset mirrors the QMX_GENRES object in the frontend JS, but extended
with server-side pedalboard parameters (HPF cutoff, saturation drive, etc.).

Chain order:
  HPF → LowShelf EQ → Peaking Mid-Dip → Peaking Presence → HighShelf Air
  → Saturation → Bus Compressor → Stereo Widener → Makeup Gain → Brickwall Limiter

Target output: -14 LUFS integrated, -1 dBTP true peak, 44100 Hz, 24-bit WAV
"""

GENRES: dict = {
    "pop": {
        "label": "Pop",
        # HPF – remove sub rumble
        "hpf_hz": 30.0,
        # 4-band EQ
        "low_shelf":   {"freq_hz": 110.0, "gain_db": 2.5},
        "mid_dip":     {"freq_hz": 350.0, "q": 0.9,  "gain_db": -2.0},
        "presence":    {"freq_hz": 3500.0, "q": 0.7,  "gain_db": 4.0},
        "air_shelf":   {"freq_hz": 12000.0, "gain_db": 4.5},
        # Saturation (Pedalboard Distortion drive 0.0-1.0)
        "saturation_drive": 0.18,
        # Bus compressor
        "comp": {
            "threshold_db": -20.0,
            "ratio": 2.6,
            "attack_ms": 5.0,
            "release_ms": 140.0,
            "knee_db": 8.0,
            "makeup_db": 2.0,
        },
        # Stereo widener (MS width factor: 1.0 = no change, 2.0 = very wide)
        "width": 1.85,
        # Brickwall limiter
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 60.0,
        },
        # Loudness target (overrides global default if set)
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "hiphop": {
        "label": "Hip-Hop",
        "hpf_hz": 20.0,
        "low_shelf":   {"freq_hz": 50.0,   "gain_db": 6.0},
        "mid_dip":     {"freq_hz": 450.0,  "q": 1.1,  "gain_db": -3.5},
        "presence":    {"freq_hz": 2500.0, "q": 0.8,  "gain_db": 1.0},
        "air_shelf":   {"freq_hz": 10000.0, "gain_db": 0.5},
        "saturation_drive": 0.20,
        "comp": {
            "threshold_db": -20.0,
            "ratio": 3.0,
            "attack_ms": 5.0,
            "release_ms": 120.0,
            "knee_db": 8.0,
            "makeup_db": 2.5,
        },
        "width": 1.45,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 60.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "rnb": {
        "label": "R&B",
        "hpf_hz": 28.0,
        "low_shelf":   {"freq_hz": 110.0,  "gain_db": 3.0},
        "mid_dip":     {"freq_hz": 500.0,  "q": 0.9,  "gain_db": -1.3},
        "presence":    {"freq_hz": 3000.0, "q": 0.75, "gain_db": 2.8},
        "air_shelf":   {"freq_hz": 11500.0, "gain_db": 4.5},
        "saturation_drive": 0.15,
        "comp": {
            "threshold_db": -22.0,
            "ratio": 2.2,
            "attack_ms": 10.0,
            "release_ms": 200.0,
            "knee_db": 10.0,
            "makeup_db": 1.8,
        },
        "width": 1.95,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 80.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "rock": {
        "label": "Rock",
        "hpf_hz": 35.0,
        "low_shelf":   {"freq_hz": 82.0,   "gain_db": 3.2},
        "mid_dip":     {"freq_hz": 450.0,  "q": 1.0,  "gain_db": -1.2},
        "presence":    {"freq_hz": 3800.0, "q": 0.95, "gain_db": 3.2},
        "air_shelf":   {"freq_hz": 10000.0, "gain_db": 2.8},
        "saturation_drive": 0.35,      # more tape grit for rock
        "comp": {
            "threshold_db": -19.0,
            "ratio": 3.0,
            "attack_ms": 6.0,
            "release_ms": 150.0,
            "knee_db": 6.0,
            "makeup_db": 3.0,
        },
        "width": 1.70,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 60.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "electronic": {
        "label": "Electronic",
        "hpf_hz": 22.0,
        "low_shelf":   {"freq_hz": 60.0,   "gain_db": 4.5},
        "mid_dip":     {"freq_hz": 280.0,  "q": 0.9,  "gain_db": -1.8},
        "presence":    {"freq_hz": 4500.0, "q": 0.95, "gain_db": 2.5},
        "air_shelf":   {"freq_hz": 12000.0, "gain_db": 3.5},
        "saturation_drive": 0.22,
        "comp": {
            "threshold_db": -19.0,
            "ratio": 3.2,
            "attack_ms": 3.0,
            "release_ms": 100.0,
            "knee_db": 6.0,
            "makeup_db": 2.8,
        },
        "width": 2.10,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 50.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "acoustic": {
        "label": "Acoustic",
        "hpf_hz": 40.0,
        "low_shelf":   {"freq_hz": 130.0,  "gain_db": 1.8},
        "mid_dip":     {"freq_hz": 400.0,  "q": 0.9,  "gain_db": -1.0},
        "presence":    {"freq_hz": 3000.0, "q": 0.7,  "gain_db": 2.2},
        "air_shelf":   {"freq_hz": 11000.0, "gain_db": 3.5},
        "saturation_drive": 0.08,      # barely any – preserve naturalness
        "comp": {
            "threshold_db": -24.0,
            "ratio": 1.8,
            "attack_ms": 12.0,
            "release_ms": 220.0,
            "knee_db": 12.0,
            "makeup_db": 1.2,
        },
        "width": 1.50,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 90.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "country": {
        "label": "Country",
        "hpf_hz": 32.0,
        "low_shelf":   {"freq_hz": 95.0,   "gain_db": 3.2},
        "mid_dip":     {"freq_hz": 380.0,  "q": 0.9,  "gain_db": -1.5},
        "presence":    {"freq_hz": 3200.0, "q": 0.85, "gain_db": 3.5},
        "air_shelf":   {"freq_hz": 10500.0, "gain_db": 4.0},
        "saturation_drive": 0.25,      # subtle Nashville tape warmth
        "comp": {
            "threshold_db": -20.0,
            "ratio": 2.6,
            "attack_ms": 6.0,
            "release_ms": 160.0,
            "knee_db": 8.0,
            "makeup_db": 2.6,
        },
        "width": 1.70,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 60.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },

    "trap": {
        "label": "Trap",
        "hpf_hz": 18.0,
        "low_shelf":   {"freq_hz": 45.0,   "gain_db": 6.5},
        "mid_dip":     {"freq_hz": 400.0,  "q": 1.2,  "gain_db": -4.0},
        "presence":    {"freq_hz": 5000.0, "q": 0.9,  "gain_db": 4.5},
        "air_shelf":   {"freq_hz": 11000.0, "gain_db": 3.0},
        "saturation_drive": 0.30,
        "comp": {
            "threshold_db": -22.0,
            "ratio": 4.0,
            "attack_ms": 3.0,
            "release_ms": 100.0,
            "knee_db": 6.0,
            "makeup_db": 3.0,
        },
        "width": 1.60,
        "limiter": {
            "threshold_db": -1.0,
            "release_ms": 50.0,
        },
        "target_lufs": -14.0,
        "target_tp_db": -1.0,
    },
}

# Default genre used when no genre is specified
DEFAULT_GENRE = "pop"


def get_preset(genre: str) -> dict:
    """Return the preset dict for the given genre key (case-insensitive)."""
    key = genre.lower().replace("-", "").replace("&", "").replace(" ", "")
    # Handle aliases
    alias_map = {
        "hiphop": "hiphop",
        "rnb": "rnb",
        "rb": "rnb",
        "randb": "rnb",
        "edm": "electronic",
        "electronica": "electronic",
        "folk": "acoustic",
        "singer": "acoustic",
        "singersongwriter": "acoustic",
    }
    key = alias_map.get(key, key)
    if key not in GENRES:
        raise KeyError(f"Unknown genre '{genre}'. Available: {list(GENRES.keys())}")
    return GENRES[key]
