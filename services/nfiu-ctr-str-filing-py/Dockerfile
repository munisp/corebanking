FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libxml2 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port 8283 --workers ${UVICORN_WORKERS:-4}"]