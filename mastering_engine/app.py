"""
app.py – Stemy Mastering Engine REST API

Endpoints:
  POST /master
      Body     : multipart/form-data
                   file   (required) – audio file (WAV, AIFF, FLAC, MP3 …)
                   genre  (optional) – one of: pop, hiphop, rnb, rock, electronic,
                                       acoustic, country  (default: pop)
      Response : audio/wav – 44.1 kHz / 24-bit PCM WAV, stereo
                  Headers: X-Lufs-Actual, X-Tp-Actual, X-Genre, X-Processing-Time-Ms

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
import urllib.request
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
    ".wav", ".mp3", ".flac", ".aiff", ".aif",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _is_allowed(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def _cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers":
            "X-Lufs-Actual, X-Tp-Actual, X-Genre, X-Processing-Time-Ms",
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
        log.info("[QUICK MASTER] CORS pre-flight request")
        return ("", 204, _cors_headers())

    log.info("[QUICK MASTER] New mastering request received")
    log.info("[QUICK MASTER] Request headers: %s", dict(request.headers))
    log.info("[QUICK MASTER] Request form data: %s", dict(request.form))
    log.info("[QUICK MASTER] Request files: %s", list(request.files.keys()))

    # ── Validate file ────────────────────────────────────────────────────────
    if "file" not in request.files:
        log.error("[QUICK MASTER] Missing 'file' field in multipart form")
        abort(400, description="Missing 'file' field in multipart form.")

    f = request.files["file"]
    log.info("[QUICK MASTER] File received: %s", f.filename)
    log.info("[QUICK MASTER] File content type: %s", f.content_type)
    log.info("[QUICK MASTER] File size: %s bytes", f.content_length)
    
    if not f.filename:
        log.error("[QUICK MASTER] Empty filename")
        abort(400, description="Empty filename.")

    if not _is_allowed(f.filename):
        log.error("[QUICK MASTER] Unsupported file type: %s", f.filename)
        abort(
            415,
            description=(
                f"Unsupported file type '{Path(f.filename).suffix}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    # ── Parse genre ──────────────────────────────────────────────────────────
    genre = (request.form.get("genre") or DEFAULT_GENRE).strip().lower()
    log.info("[QUICK MASTER] Genre: %s", genre)

    # ── Parse metadata ───────────────────────────────────────────────────────
    metadata = None
    metadata_raw = request.form.get("metadata")
    if metadata_raw:
        try:
            import json
            metadata = json.loads(metadata_raw)
            log.info("[QUICK MASTER] Metadata: %s", metadata)
        except (json.JSONDecodeError, TypeError) as exc:
            log.warning("[QUICK MASTER] Invalid metadata JSON: %s", exc)

    # ── Parse cover art ──────────────────────────────────────────────────────
    art_bytes = None
    if "artwork" in request.files:
        art_file = request.files["artwork"]
        if art_file and art_file.filename:
            art_bytes = art_file.read()
            log.info("[QUICK MASTER] Artwork received directly: %s (%d bytes)",
                     art_file.filename, len(art_bytes))
    
    # Fallback: if no direct artwork but metadata has artworkUrl, fetch it
    if art_bytes is None and metadata and metadata.get("artworkUrl"):
        url = metadata["artworkUrl"]
        log.info("[QUICK MASTER] Fetching artwork from URL: %s", url)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Stemy/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                art_bytes = resp.read()
            log.info("[QUICK MASTER] Artwork fetched from URL: %d bytes", len(art_bytes))
        except Exception as exc:
            log.warning("[QUICK MASTER] Failed to fetch artwork from URL: %s", exc)
            art_bytes = None
    
    try:
        preset = get_preset(genre)
        log.info("[QUICK MASTER] Genre preset loaded successfully")
    except KeyError as exc:
        log.error("[QUICK MASTER] Invalid genre: %s", exc)
        abort(400, description=str(exc))

    # Use preset loudness targets (can differ per genre)
    t_lufs = preset.get("target_lufs",  TARGET_LUFS)
    t_tp   = preset.get("target_tp_db", TARGET_TP_DB)

    log.info(
        "[QUICK MASTER] Processing request — file=%s size=%s genre=%s target=%.1f LUFS / %.1f dBTP",
        f.filename,
        f"{f.content_length // 1024} KB" if f.content_length else "?",
        genre,
        t_lufs,
        t_tp,
    )

    # ── Read raw bytes ────────────────────────────────────────────────────────
    try:
        log.info("[QUICK MASTER] Reading file bytes...")
        raw = f.read()
        log.info("[QUICK MASTER] Successfully read %d bytes", len(raw))
    except Exception as exc:
        log.error("[QUICK MASTER] Failed to read upload: %s", exc)
        abort(500, description="Could not read uploaded file.")

    # ── Run mastering chain ───────────────────────────────────────────────────
    t_start = time.perf_counter()
    try:
        log.info("[QUICK MASTER] Starting audio processing...")
        wav_bytes, final_lufs, final_tp = master_audio(
            raw,
            genre=genre,
            target_lufs=t_lufs,
            target_tp_db=t_tp,
            metadata=metadata,
            artwork_bytes=art_bytes,
        )
        log.info("[QUICK MASTER] Audio processing completed. Output size: %d bytes", len(wav_bytes))
    except Exception as exc:
        log.exception("[QUICK MASTER] Mastering failed for %s: %s", f.filename, exc)
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
        "X-Lufs-Actual":         str(round(final_lufs, 2)),
        "X-Tp-Actual":           str(round(final_tp, 2)),
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
    host = os.environ.get("HOST", "127.0.0.1")
    debug = False
    log.info("Starting Stemy Mastering Engine on %s:%d (debug=%s)", host, port, debug)
    app.run(host=host, port=port, debug=debug)
