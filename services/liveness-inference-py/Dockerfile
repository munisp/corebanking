FROM python:3.12-slim
RUN useradd -m appuser
WORKDIR /app
COPY requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
COPY . .
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8230}/healthz')" || exit 1
ENTRYPOINT ["python", "main.py"]
