"""
Country preset — Nashville warmth, pick attack, bright.
"""

COUNTRY = {
    "label": "Country",
    "hpf_hz": 32.0,
    "low_shelf":   {"freq_hz": 95.0,   "gain_db": 3.2},
    "mid_dip":     {"freq_hz": 380.0,  "q": 0.9,  "gain_db": -1.5},
    "presence":    {"freq_hz": 3200.0, "q": 0.85, "gain_db": 3.5},
    "air_shelf":   {"freq_hz": 10500.0, "gain_db": 4.0},
    "saturation_drive": 0.25,
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
}
