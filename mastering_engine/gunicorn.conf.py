# gunicorn.conf.py – production Gunicorn settings for the mastering engine
import os

# Bind address
bind = f"0.0.0.0:{os.environ.get('PORT', '5050')}"

# Workers: 2 per CPU core is typical for I/O-bound work;
# mastering is CPU-bound so use (CPUs + 1) as a safe starting point.
import multiprocessing
workers = multiprocessing.cpu_count() + 1

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
