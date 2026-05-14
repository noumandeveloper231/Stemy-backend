"""
Pop preset — vocal-forward, bright, wide stereo.
"""

POP = {
    "label": "Pop",
    "hpf_hz": 30.0,
    "low_shelf":   {"freq_hz": 110.0,  "gain_db": 2.5},
    "mid_dip":     {"freq_hz": 350.0,  "q": 0.9,  "gain_db": -2.0},
    "presence":    {"freq_hz": 3500.0, "q": 0.7,  "gain_db": 4.0},
    "air_shelf":   {"freq_hz": 12000.0, "gain_db": 4.5},
    "saturation_drive": 0.18,
    "comp": {
        "threshold_db": -20.0,
        "ratio": 2.6,
        "attack_ms": 5.0,
        "release_ms": 140.0,
        "knee_db": 8.0,
        "makeup_db": 2.0,
    },
    "width": 1.85,
    "limiter": {
        "threshold_db": -1.0,
        "release_ms": 60.0,
    },
    "target_lufs": -14.0,
    "target_tp_db": -1.0,
}
