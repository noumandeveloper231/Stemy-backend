"""
Acoustic preset — natural, transparent, gentle comp.
"""

ACOUSTIC = {
    "label": "Acoustic",
    "hpf_hz": 40.0,
    "low_shelf":   {"freq_hz": 130.0,  "gain_db": 1.8},
    "mid_dip":     {"freq_hz": 400.0,  "q": 0.9,  "gain_db": -1.0},
    "presence":    {"freq_hz": 3000.0, "q": 0.7,  "gain_db": 2.2},
    "air_shelf":   {"freq_hz": 11000.0, "gain_db": 3.5},
    "saturation_drive": 0.08,
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
}
