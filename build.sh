#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Installing Python dependencies..."
pip install --only-binary=:all: -r mastering_engine/requirements.txt

echo "Build complete!"