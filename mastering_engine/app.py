"""
app.py – Stemy Mastering Engine REST API

Endpoints:
  POST /master
      Body     : multipart/form-data
                   file   (required) – audio file (WAV, MP3, FLAC, M4A, OGG, AIFF …)
                   genre  (optional) – one of: pop, hiphop, rnb, rock, electronic,
                                       acoustic, country  (default: pop)
      Response : audio/wav – 44.1 kHz / 24-bit PCM WAV, stereo
                 Headers: X-Lufs-Target, X-Tp-Target, X-Genre, X-Processing-Time-Ms

  GET /genres
      Response : JSON list of available genre keys + labels

  GET /health
      Response : {"status": "ok"}

Usage:
  python app.py                    # dev server on :5050
  gunicorn -w 2 -b 0.0.0.0:5050 app:app   # production
"""

from __future__ import annotations

import io
import logging
import os
import time
from pathlib import Path

from flask import Flask, jsonify, request, send_file, abort
from flask_cors import CORS

from genres import GENRES, DEFAULT_GENRE, get_preset
from dsp_chain import master_audio, TARGET_LUFS, TARGET_TP_DB

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("stemy.api")

# ─── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})   # allow all origins (update in prod)

# Max upload size: 100 MB (server-side limit; frontend restricts to 20 MB)
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".flac", ".aac", ".m4a",
    ".ogg", ".oga", ".aiff", ".aif", ".opus",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _is_allowed(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def _cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers":
            "X-Lufs-Target, X-Tp-Target, X-Genre, X-Processing-Time-Ms",
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "message": "Stemy Mastering Engine API is running.",
        "endpoints": {
            "health": "GET /health",
            "genres": "GET /genres",
            "master": "POST /master (requires 'file' and 'genre' in form-data)"
        }
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "stemy-mastering-engine"})


@app.route("/genres", methods=["GET"])
def genres():
    """Return all available genre keys and human-readable labels."""
    data = [{"key": k, "label": v["label"]} for k, v in GENRES.items()]
    return jsonify(data)


@app.route("/master", methods=["POST", "OPTIONS"])
def master():
    # CORS pre-flight
    if request.method == "OPTIONS":
        return ("", 204, _cors_headers())

    # ── Validate file ────────────────────────────────────────────────────────
    if "file" not in request.files:
        abort(400, description="Missing 'file' field in multipart form.")

    f = request.files["file"]
    if not f.filename:
        abort(400, description="Empty filename.")

    if not _is_allowed(f.filename):
        abort(
            415,
            description=(
                f"Unsupported file type '{Path(f.filename).suffix}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    # ── Parse genre ──────────────────────────────────────────────────────────
    genre = (request.form.get("genre") or DEFAULT_GENRE).strip().lower()
    try:
        preset = get_preset(genre)
    except KeyError as exc:
        abort(400, description=str(exc))

    # Use preset loudness targets (can differ per genre)
    t_lufs = preset.get("target_lufs",  TARGET_LUFS)
    t_tp   = preset.get("target_tp_db", TARGET_TP_DB)

    log.info(
        "Request — file=%s size=%s genre=%s target=%.1f LUFS / %.1f dBTP",
        f.filename,
        f"{f.content_length // 1024} KB" if f.content_length else "?",
        genre,
        t_lufs,
        t_tp,
    )

    # ── Read raw bytes ────────────────────────────────────────────────────────
    try:
        raw = f.read()
    except Exception as exc:
        log.error("Failed to read upload: %s", exc)
        abort(500, description="Could not read uploaded file.")

    # ── Run mastering chain ───────────────────────────────────────────────────
    t_start = time.perf_counter()
    try:
        wav_bytes = master_audio(
            raw,
            genre=genre,
            target_lufs=t_lufs,
            target_tp_db=t_tp,
        )
    except Exception as exc:
        log.exception("Mastering failed for %s: %s", f.filename, exc)
        abort(
            500,
            description=(
                f"Mastering failed: {exc}. "
                "Ensure the file is a valid audio file and try again."
            ),
        )
    elapsed_ms = int((time.perf_counter() - t_start) * 1000)

    log.info(
        "Done — genre=%s elapsed=%d ms output=%d KB",
        genre,
        elapsed_ms,
        len(wav_bytes) // 1024,
    )

    # ── Build download filename ───────────────────────────────────────────────
    stem = Path(f.filename).stem
    download_name = f"{stem}_mastered_{genre}.wav"

    # ── Return WAV ────────────────────────────────────────────────────────────
    response = send_file(
        io.BytesIO(wav_bytes),
        mimetype="audio/wav",
        as_attachment=True,
        download_name=download_name,
    )
    response.headers.update({
        **_cors_headers(),
        "X-Genre":               genre,
        "X-Lufs-Target":         str(t_lufs),
        "X-Tp-Target":           str(t_tp),
        "X-Processing-Time-Ms":  str(elapsed_ms),
        "Cache-Control":         "no-store",
    })
    return response


# ─── JSON error handlers ──────────────────────────────────────────────────────

@app.errorhandler(400)
@app.errorhandler(415)
@app.errorhandler(500)
def json_error(exc):
    code = exc.code if hasattr(exc, "code") else 500
    msg  = exc.description if hasattr(exc, "description") else str(exc)
    log.error("HTTP %d: %s", code, msg)
    return jsonify({"error": msg, "code": code}), code


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    debug = os.environ.get("FLASK_ENV", "production").lower() == "development"
    log.info("Starting Stemy Mastering Engine on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
