"""
Genre presets package — rollout v1: Hip-Hop, Trap, R&B only.
"""

from .hiphop import HIPHOP
from .rnb import RNB
from .trap import TRAP

GENRES: dict = {
    "hiphop": HIPHOP,
    "rnb": RNB,
    "trap": TRAP,
}

DEFAULT_GENRE = "hiphop"


def get_preset(genre: str) -> dict:
    """Return the preset dict for the given genre key (case-insensitive)."""
    key = genre.lower().replace("-", "").replace("&", "").replace(" ", "")
    alias_map = {
        "hiphop": "hiphop",
        "rnb": "rnb",
        "rb": "rnb",
        "randb": "rnb",
    }
    key = alias_map.get(key, key)
    if key not in GENRES:
        raise KeyError(f"Unknown genre '{genre}'. Available: {list(GENRES.keys())}")
    return GENRES[key]
