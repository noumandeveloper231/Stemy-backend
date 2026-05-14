"""
Genre presets package.
Each genre lives in its own file so the DSP engineer can swap one out
without touching the others.
"""

from .pop import POP
from .hiphop import HIPHOP
from .rnb import RNB
from .rock import ROCK
from .electronic import ELECTRONIC
from .acoustic import ACOUSTIC
from .country import COUNTRY
from .trap import TRAP

GENRES: dict = {
    "pop": POP,
    "hiphop": HIPHOP,
    "rnb": RNB,
    "rock": ROCK,
    "electronic": ELECTRONIC,
    "acoustic": ACOUSTIC,
    "country": COUNTRY,
    "trap": TRAP,
}

DEFAULT_GENRE = "pop"


def get_preset(genre: str) -> dict:
    """Return the preset dict for the given genre key (case-insensitive)."""
    key = genre.lower().replace("-", "").replace("&", "").replace(" ", "")
    alias_map = {
        "hiphop": "hiphop",
        "rnb": "rnb",
        "rb": "rnb",
        "randb": "rnb",
        "edm": "electronic",
        "electronica": "electronic",
        "folk": "acoustic",
        "singer": "acoustic",
        "singersongwriter": "acoustic",
    }
    key = alias_map.get(key, key)
    if key not in GENRES:
        raise KeyError(f"Unknown genre '{genre}'. Available: {list(GENRES.keys())}")
    return GENRES[key]
