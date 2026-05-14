"""
Hip-Hop preset — sub-heavy, dark, tight stereo.
"""

HIPHOP = {
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
}
