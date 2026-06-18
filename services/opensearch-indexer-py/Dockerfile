FROM python:3.12-slim
RUN useradd -r -s /bin/false appuser
WORKDIR /app
COPY *.py ./
USER appuser
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8080}/healthz')" || exit 1
CMD ["python", "main.py"]
