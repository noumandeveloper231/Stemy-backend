# gunicorn.conf.py – production Gunicorn settings for the mastering engine
import os

# Bind address - use PORT env var (Render sets this)
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
