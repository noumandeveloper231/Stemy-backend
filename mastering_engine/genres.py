"""
Genre presets for the Stemy mastering engine.

Each preset now lives in its own file under the `presets/` package so the DSP
engineer can swap or tune one without touching the others.

Preset files:  presets/pop.py, presets/hiphop.py, presets/rnb.py, ...
"""

from presets import GENRES, DEFAULT_GENRE, get_preset

__all__ = ["GENRES", "DEFAULT_GENRE", "get_preset"]
