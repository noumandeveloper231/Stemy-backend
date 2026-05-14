"""
Electronic preset — maximum sub + width, club loudness.
"""

ELECTRONIC = {
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
}
