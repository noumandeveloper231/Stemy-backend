# gunicorn.conf.py – production Gunicorn settings for the mastering engine
import os
import sys

# Add mastering_engine to path so we can import app from repo root
sys.path.insert(0, os.path.join(os.getcwd(), 'mastering_engine'))

# Bind address - Render sets PORT env var
port = os.environ.get("PORT")
bind = f"0.0.0.0:{port}" if port else "0.0.0.0:10000"

# Workers - use 1 for free tier to save memory
workers = 1

# Worker class
worker_class = "sync"

# Timeout - 10 minutes for large audio files
timeout = 600

# Graceful timeout for shutdown
graceful_timeout = 30

# Keepalive to prevent connection drops
keepalive = 5

# Max requests per worker before restart (disable for stability)
max_requests = 0
max_requests_jitter = 0

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Disable preload to save memory
preload_app = False

# Worker retries for stability
worker_tmp_dir = "/dev/shm"