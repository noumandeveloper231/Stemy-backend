# Stemy — Audio Mastering Engine

Server-side DSP mastering backend built with **Python**, **pedalboard** (Spotify), **pyloudnorm**, and **Flask**.

## Architecture

```
stemy-frontend (HTML/JS)         Node.js (Express)            Python Flask
     │                                │                           │
     │  POST /api/masters/quick       │                           │
     │  (FormData: file + genre)      │                           │
     ├───────────────────────────────>│                           │
     │                                │  BullMQ job queue         │
     │                                │  ───────────────────      │
     │                                │                           │
     │                                │  POST /master             │
     │                                │  (FormData: file + genre) │
     │                                ├──────────────────────────>│
     │                                │                           │
     │                                │  ← audio/wav + headers    │
     │                                │    X-Lufs-Actual          │
     │                                │    X-Tp-Actual            │
     │                                │    X-Genre                │
     │                                │                           │
     │  ← { master } with lufs/dbtp   │                           │
     │<───────────────────────────────│                           │
```

## DSP Chain

```
Input audio
   │
   ▼
 ① High-Pass Filter       (removes sub-sonic rumble / DC offset)
   │
   ▼
 ② 4-Band EQ
   ├─ Low Shelf           (bass weight)
   ├─ Mid-Dip Peaking     (mud & boxiness removal)
   ├─ Presence Peaking    (vocal/instrument clarity)
   └─ Air High Shelf      (top-end sparkle)
   │
   ▼
 ③ Saturation             (soft-clip harmonic warmth — cubic + tanh)
   │
   ▼
 ④ Bus Compressor         (dynamics glue)
   │
   ▼
 ⑤ Stereo Widener         (Mid/Side width expansion)
   │
   ▼
 ⑥ LUFS Normalisation     (iterative gain → limiter passes)
   │
   ▼
 ⑦ Brickwall Limiter      (true-peak ceiling at -1 dBTP)
   │
   ▼
Output: 44 100 Hz · 24-bit PCM WAV · -14 LUFS · -1 dBTP
```

## Genre Presets

Each genre lives in its own file under `presets/` so the engineer can swap
one out without affecting the others.

| File                     | Key          | Label       | Character                              |
|:-------------------------|:-------------|:------------|:---------------------------------------|
| `presets/pop.py`         | `pop`        | Pop         | Vocal-forward, bright, wide            |
| `presets/hiphop.py`      | `hiphop`     | Hip-Hop     | Sub-heavy, dark, tight stereo          |
| `presets/rnb.py`         | `rnb`        | R&B         | Silky highs, smooth comp, wide         |
| `presets/rock.py`        | `rock`       | Rock        | Tape grit, punchy mids, guitar bite    |
| `presets/electronic.py`  | `electronic` | Electronic  | Maximum sub + width, club loudness     |
| `presets/acoustic.py`    | `acoustic`   | Acoustic    | Natural, transparent, gentle comp      |
| `presets/country.py`     | `country`    | Country     | Nashville warmth, pick attack, bright  |
| `presets/trap.py`        | `trap`       | Trap        | Heavy 808 sub, aggressive comp, bright |

### Adding or modifying a preset

1. Create a new file `presets/<key>.py` (or edit an existing one).
2. Each file exports a single dict constant (same name as the key, uppercase).
3. The dict must contain: `label`, `hpf_hz`, `low_shelf`, `mid_dip`, `presence`,
   `air_shelf`, `saturation_drive`, `comp`, `width`, `limiter`,
   `target_lufs`, `target_tp_db`.
4. Register the import in `presets/__init__.py` and add it to the `GENRES` dict.
5. The frontend genre selector buttons are in each page's `qmx-genres` div.
   Add a new `<button class="qmx-genre" data-g="<key>">` following the
   existing pattern.

### Configurable parameters per preset

| Parameter          | Type   | Description                                   |
|:-------------------|:-------|:----------------------------------------------|
| `hpf_hz`           | float  | High-pass filter cutoff (Hz)                  |
| `low_shelf`        | dict   | `freq_hz`, `gain_db`                          |
| `mid_dip`          | dict   | `freq_hz`, `q`, `gain_db`                     |
| `presence`         | dict   | `freq_hz`, `q`, `gain_db`                     |
| `air_shelf`        | dict   | `freq_hz`, `gain_db`                          |
| `saturation_drive` | float  | Drive 0.0–1.0 (0.0 = bypass)                  |
| `comp`             | dict   | `threshold_db`, `ratio`, `attack_ms`, `release_ms`, `knee_db`, `makeup_db` |
| `width`            | float  | Mid/Side width factor (1.0 = no change)       |
| `limiter`          | dict   | `threshold_db`, `release_ms`                  |
| `target_lufs`      | float  | Integrated LUFS target (e.g. -14.0)           |
| `target_tp_db`     | float  | True-peak ceiling in dBTP (e.g. -1.0)         |

These live **in the preset file**, not hardcoded in the DSP chain.

## API Endpoints

### `POST /master`
Masters an uploaded audio file.

**Request** — `multipart/form-data`
| Field     | Required | Description                                      |
|:----------|:---------|:-------------------------------------------------|
| `file`    | ✅       | Audio file (WAV, MP3, FLAC, AIFF)               |
| `genre`   | ❌       | Genre preset key (default: `pop`)                |
| `metadata`| ❌       | JSON string with title, artist, album, year, etc.|
| `artwork` | ❌       | Cover art image file (JPEG/PNG)                  |

**Response** — `audio/wav` (44.1 kHz / 24-bit / stereo)

**Response Headers**
| Header                   | Description                          |
|:-------------------------|:-------------------------------------|
| `X-Genre`                | Applied genre key                    |
| `X-Lufs-Actual`          | Measured integrated LUFS             |
| `X-Tp-Actual`            | Measured true-peak (dBTP)            |
| `X-Processing-Time-Ms`   | Server-side processing time (ms)     |

**Example with cURL**
```bash
curl -X POST http://localhost:5050/master \
  -F "file=@my_mix.wav" \
  -F "genre=hiphop" \
  --output my_mix_mastered.wav
```

### `GET /genres`
Returns all available genre keys and labels.
```json
[
  {"key": "pop",        "label": "Pop"},
  {"key": "hiphop",     "label": "Hip-Hop"},
  {"key": "rnb",        "label": "R&B"},
  {"key": "rock",       "label": "Rock"},
  {"key": "electronic", "label": "Electronic"},
  {"key": "acoustic",   "label": "Acoustic"},
  {"key": "country",    "label": "Country"},
  {"key": "trap",       "label": "Trap"}
]
```

### `GET /health`
```json
{"status": "ok", "service": "stemy-mastering-engine"}
```

---

## Frontend Integration

The frontend communicates with this engine via the Node.js backend, never
directly. The flow is:

1. User uploads audio + selects genre in `mastering.html`
2. `main.js` sends `POST /api/masters/quick` with `FormData { audio, genre, metadata }`
3. Node.js stores the file in Cloudflare R2 and enqueues a BullMQ job
4. The job downloads the file from R2 and forwards it to this Python engine
   via `POST /master` with `FormData { file, genre, metadata }`
5. The engine returns mastered WAV + `X-Lufs-Actual` / `X-Tp-Actual` headers
6. Node.js uploads the result to R2 and stores metrics in the database
7. Frontend polls for completion and displays the metrics

### Stable API contract

The boundary between frontend and backend is the `POST /master` endpoint.
Changes to DSP internals (EQ curves, compressor settings, new presets) do
**not** require frontend changes as long as:
- The genre key string stays the same
- The response format (WAV + `X-Lufs-Actual` / `X-Tp-Actual` headers) stays the same

## Setup & Running

### 1. Install dependencies
```bash
cd mastering_engine
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Development server
```bash
python app.py
# → http://localhost:5050
```

### 3. Production server (Gunicorn)
```bash
gunicorn -c gunicorn.conf.py app:app
```

### 4. Test the CLI directly (no API)
```bash
python dsp_chain.py my_mix.wav hiphop my_mix_mastered.wav
```
This runs the same DSP chain without needing Flask or the web UI.
Supports all genres. See `python dsp_chain.py --help` (or the source).

## Output Specification
| Property        | Value                   |
|:----------------|:------------------------|
| Sample rate     | 44 100 Hz               |
| Bit depth       | 24-bit PCM              |
| Channels        | Stereo                  |
| Integrated LUFS | −14.0 LUFS (streaming)  |
| True peak       | −1.0 dBTP               |
| Format          | WAV (`.wav`)            |

## Project Layout

```
mastering_engine/
├── app.py              — Flask REST API (routes, validation, CORS)
├── dsp_chain.py        — Core DSP chain (Pedalboard, saturation, limiter, normalisation)
├── genres.py           — Loads all presets from presets/ package
├── presets/
│   ├── __init__.py     — GENRES dict, get_preset(), DEFAULT_GENRE
│   ├── pop.py          — Pop preset
│   ├── hiphop.py       — Hip-Hop preset
│   ├── rnb.py          — R&B preset
│   ├── rock.py         — Rock preset
│   ├── electronic.py   — Electronic preset
│   ├── acoustic.py     — Acoustic preset
│   ├── country.py      — Country preset
│   └── trap.py         — Trap preset
├── gunicorn.conf.py    — Production WSGI config
├── requirements.txt    — Python dependencies
└── README.md           — This file
```
