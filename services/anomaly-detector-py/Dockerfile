FROM python:3.11-slim
RUN useradd -m -u 1001 appuser
WORKDIR /app
COPY main.py .
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8516/healthz')" || exit 1
EXPOSE 8516
CMD ["python", "main.py"]
