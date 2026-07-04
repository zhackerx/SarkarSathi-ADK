# SarkarSathi ADK — container image (Flask + ADK, served by gunicorn).
# Build context is the PROJECT ROOT so both backend/ and frontend/ are copied.
#   docker build -t sarkarsathi-adk .
#   docker run -p 8080:8080 -e GOOGLE_API_KEY=your_key sarkarsathi-adk
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_PORT=8080

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

COPY backend/ backend/
COPY frontend/ frontend/

WORKDIR /app/backend
EXPOSE 8080

# 2 workers, 8 threads — Gemini/ADK calls are I/O bound.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--threads", "8", "--timeout", "120", "app:app"]
