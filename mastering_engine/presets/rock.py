"""
Rock preset — tape grit, punchy mids, guitar bite.
"""

ROCK = {
    "label": "Rock",
    "hpf_hz": 35.0,
    "low_shelf":   {"freq_hz": 82.0,   "gain_db": 3.2},
    "mid_dip":     {"freq_hz": 450.0,  "q": 1.0,  "gain_db": -1.2},
    "presence":    {"freq_hz": 3800.0, "q": 0.95, "gain_db": 3.2},
    "air_shelf":   {"freq_hz": 10000.0, "gain_db": 2.8},
    "saturation_drive": 0.35,
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
}
