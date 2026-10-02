FROM python:3.12-slim
WORKDIR /app
COPY main.py .
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8703} --workers ${UVICORN_WORKERS:-4}"]