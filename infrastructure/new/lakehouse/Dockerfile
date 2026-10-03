# 54Bank — Lakehouse REST API server (server.py, port 8020)
# Build context: infrastructure/new (Dockerfile expects ./lakehouse package).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY lakehouse/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY lakehouse /app/lakehouse

RUN useradd -u 1000 -m appuser
USER 1000

EXPOSE 8020

CMD ["python", "-m", "lakehouse.server"]
