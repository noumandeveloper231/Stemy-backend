"""
Trap preset — heavy 808 sub, aggressive comp, bright hits.
"""

TRAP = {
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
}
