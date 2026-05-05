# gunicorn.conf.py – production Gunicorn settings for the mastering engine
import os
import sys

# Add mastering_engine to path so we can import app from repo root
sys.path.insert(0, os.path.join(os.getcwd(), 'mastering_engine'))

# Bind address - use 0.0.0.0 for separate service deployment
bind = f"0.0.0.0:{os.environ.get('PORT', '5050')}"

# Workers - use 1 for free tier to save memory
workers = 1

# Worker class – sync is fine for CPU-heavy tasks
worker_class = "sync"

# Generous timeout for long mastering jobs (large files)
timeout = 300   # seconds

# Max requests per worker before graceful restart (memory leak protection)
max_requests = 500
max_requests_jitter = 50

# Logging
accesslog = "-"   # stdout
errorlog  = "-"   # stderr
loglevel  = "info"

# Preload app to share memory across workers
preload_app = True
