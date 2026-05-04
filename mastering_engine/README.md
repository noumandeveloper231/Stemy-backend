# Stemy — Audio Mastering Engine

Server-side DSP mastering backend built with **Python**, **pedalboard** (Spotify), **pyloudnorm**, and **Flask**.

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
Output: 44 100 Hz · 24-bit PCM WAV · -14 LUFS · -1 dBTP
```

## Genre Presets

| Key          | Label       | Character                              |
|:-------------|:------------|:---------------------------------------|
| `pop`        | Pop         | Vocal-forward, bright, wide            |
| `hiphop`     | Hip-Hop     | Sub-heavy, dark, tight stereo          |
| `rnb`        | R&B         | Silky highs, smooth comp, wide         |
| `rock`       | Rock        | Tape grit, punchy mids, guitar bite    |
| `electronic` | Electronic  | Maximum sub + width, club loudness     |
| `acoustic`   | Acoustic    | Natural, transparent, gentle comp      |
| `country`    | Country     | Nashville warmth, pick attack, bright  |

## API Endpoints

### `POST /master`
Masters an uploaded audio file.

**Request** — `multipart/form-data`
| Field  | Required | Description                                      |
|:-------|:---------|:-------------------------------------------------|
| `file` | ✅       | Audio file (WAV, MP3, FLAC, M4A, OGG, AIFF …)  |
| `genre`| ❌       | Genre preset key (default: `pop`)                |

**Response** — `audio/wav` (44.1 kHz / 24-bit / stereo)

**Response Headers**
| Header                   | Description                          |
|:-------------------------|:-------------------------------------|
| `X-Genre`                | Applied genre key                    |
| `X-Lufs-Target`          | Target integrated LUFS               |
| `X-Tp-Target`            | True-peak ceiling (dBTP)             |
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
  {"key": "country",    "label": "Country"}
]
```

### `GET /health`
```json
{"status": "ok", "service": "stemy-mastering-engine"}
```

---

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

---

## Output Specification
| Property        | Value                   |
|:----------------|:------------------------|
| Sample rate     | 44 100 Hz               |
| Bit depth       | 24-bit PCM              |
| Channels        | Stereo                  |
| Integrated LUFS | −14.0 LUFS (streaming)  |
| True peak       | −1.0 dBTP               |
| Format          | WAV (`.wav`)            |

## Frontend Integration
Point `mastering.html` to the running API URL. The `/master` endpoint accepts the same file upload the Web Audio demo already handles.

```js
const formData = new FormData();
formData.append("file", audioBlob, "mix.wav");
formData.append("genre", currentGenre);

const res = await fetch("http://localhost:5050/master", {
  method: "POST",
  body: formData,
});
const masteredBlob = await res.blob();
```
