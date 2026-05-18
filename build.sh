#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Installing Python dependencies..."
timeout 300 pip install --no-build-isolation -r mastering_engine/requirements.txt || {
    echo "Build timed out or failed, retrying binary-only..."
    pip install --only-binary=:all: -r mastering_engine/requirements.txt
}

echo "Build complete!"