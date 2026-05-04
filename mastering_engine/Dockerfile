# Use official Python 3.9 slim image as base
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for audio processing (libsndfile for soundfile)
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 5050

# Set environment variables
ENV FLASK_ENV=production
ENV PORT=5050

# Command to run the application using Gunicorn for production
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]
