# Stemy Mastering Engine

Professional audio mastering DSP chain for the Stemy web application.

## Overview

This module provides server-side audio mastering using genre-specific presets. It's designed to be modular and testable for handoff to a DSP audio engineer.

## Architecture

### DSP Chain (Processing Order)

```
Input → High-Pass Filter → 4-Band EQ → Tube Saturation → Bus Compressor → Stereo Widener → Brickwall Limiter → LUFS Normalisation → Output
```

1. **High-Pass Filter** - Removes sub-sonic rumble (30Hz default)
2. **4-Band EQ** - LowShelf, MidDip, Presence, AirShelf
3. **Tube Saturation** - Soft-clip harmonic warmth
4. **Bus Compressor** - Glue / dynamics control
5. **Stereo Widener** - Mid/Side width expansion
6. **Brickwall Limiter** - True-peak ceiling (-1 dBTP)
7. **LUFS Normalisation** - Integrated target (-14 LUFS)

### Files

```
mastering_engine/
├── README.md              # This file
├── app.py                 # Flask REST API server
├── dsp_chain.py           # Core DSP processing logic
├── genres.py              # Genre preset loader
├── ab_test.py             # A/B testing hooks
└── presets/               # Individual genre presets
    ├── __init__.py        # Preset registry
    ├── pop.py
    ├── hiphop.py
    ├── rnb.py
    ├── rock.py
    ├── electronic.py
    ├── acoustic.py
    ├── country.py
    └── trap.py
```

## For the DSP Engineer

### Adding a New Preset

1. Create a new file in `presets/` (e.g., `presets/jazz.py`)
2. Define a preset dict with the parameter structure below
3. Import and register in `presets/__init__.py`

### Preset Parameter Structure

Each genre preset is a dict with these keys:

```python
{
    "label": "Genre Name",           # Display name for UI
    "hpf_hz": 30.0,                 # High-pass filter cutoff (Hz)
    "low_shelf": {                  # Low shelf EQ
        "freq_hz": 110.0,           # Cutoff frequency
        "gain_db": 2.5,             # Boost/cut in dB
    },
    "mid_dip": {                    # Mid range dip/boost
        "freq_hz": 350.0,
        "q": 0.9,                   # Q factor (bandwidth)
        "gain_db": -2.0,
    },
    "presence": {                  # Upper mid presence
        "freq_hz": 3500.0,
        "q": 0.7,
        "gain_db": 4.0,
    },
    "air_shelf": {                 # High frequency air
        "freq_hz": 12000.0,
        "gain_db": 4.5,
    },
    "saturation_drive": 0.18,      # 0.0-1.0, soft-clip drive amount
    "comp": {                      # Bus compressor settings
        "threshold_db": -20.0,      # Compression threshold
        "ratio": 2.6,               # Compression ratio
        "attack_ms": 5.0,           # Attack time (ms)
        "release_ms": 140.0,        # Release time (ms)
        "knee_db": 8.0,             # Knee softness
        "makeup_db": 2.0,           # Makeup gain
    },
    "width": 1.85,                 # Stereo width (1.0 = mono, 2.0 = max)
    "limiter": {                   # Brickwall limiter
        "threshold_db": -1.0,
        "release_ms": 60.0,
    },
    "target_lufs": -14.0,          # Target integrated loudness
    "target_tp_db": -1.0,          # Target true-peak ceiling
}
```

### Tuning Guidelines

- **Saturation**: 0.05-0.4 for mastering use. Higher values add more harmonic color.
- **Compressor**: Start with ratio 2-4, threshold around -18 to -24 dB.
- **Stereo Width**: 1.0-2.0. Values >1.5 add significant widening.
- **Limiter**: Keep threshold at -1 dB or lower for streaming compliance.

### Running Tests

```bash
# Generate test signal and run all genres
python ab_test.py test_sweep

# Compare a specific genre against itself (for before/after testing)
python ab_test.py compare pop

# Save a reference master for regression testing
python ab_test.py save_ref pop

# Check current output against saved reference
python ab_test.py check_ref pop
```

### A/B Testing Workflow

1. **Before making changes**: Save a reference master
   ```bash
   python ab_test.py save_ref pop
   ```

2. **Make your preset changes** in the preset file

3. **After changes**: Compare against reference
   ```bash
   python ab_test.py check_ref pop
   ```

4. **Review output**:
   - LUFS difference should be < 0.5 LU
   - dBTP difference should be < 0.1 dB
   - DR (dynamic range) difference should be < 2 dB

### API Endpoints

The REST API runs on port 5050:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/genres` | GET | List available genres |
| `/master` | POST | Process audio file |

**Master endpoint**:
```
POST /master
  Content-Type: multipart/form-data
  file: <audio file>
  genre: <genre key>

Response: audio/wav with headers:
  X-Lufs-Actual: LUFS value
  X-Tp-Actual: dBTP value
  X-DR-Actual: dynamic range
  X-Duration-Actual: duration in seconds
```

### Frontend Integration

The API is designed to be stable. The frontend expects:
- `audio/wav` response with file download
- LUFS/dBTP/DR values in response headers

When the DSP engineer modifies preset values, the API interface remains unchanged—the frontend simply receives masters with different characteristics.

## Requirements

```
pip install -r requirements.txt
```

Key dependencies:
- `pedalboard` - Audio processing plugins
- `pyloudnorm` - LUFS measurement (BS.1770-3)
- `soundfile` - Audio file I/O
- `flask` - REST API server
- `numpy` - Signal processing

## Development

```bash
# Run local server
python app.py

# Run production server
gunicorn -w 2 -b 0.0.0.0:5050 app:app

# Test a single file
python dsp_chain.py input.wav pop output.wav
```