"""
R&B preset — silky highs, smooth comp, wide.
"""

RNB = {
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
}
