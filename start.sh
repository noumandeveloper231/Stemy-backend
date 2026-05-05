#!/bin/bash
set -e

# Start Python mastering engine in background (completely detached)
# Using nohup and redirecting all output to prevent Render from detecting the port
if [ "$NODE_ENV" = "production" ]; then
    echo "Starting Python mastering engine..."
    nohup python3 -c "
import sys
sys.path.insert(0, 'mastering_engine')
from app import app
app.run(host='127.0.0.1', port=5050, threaded=True)
" > /tmp/python.log 2>&1 &
    
    # Wait for Python to start
    for i in {1..30}; do
        if curl -s http://127.0.0.1:5050/health > /dev/null 2>&1; then
            echo "Python engine ready"
            break
        fi
        sleep 1
    done
fi

# Start Node.js server
exec node src/server.js