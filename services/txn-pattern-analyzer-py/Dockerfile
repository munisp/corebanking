FROM python:3.11-slim
WORKDIR /app
COPY main.py .
RUN useradd -m -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8581/healthz')" || exit 1
EXPOSE 8581
CMD ["python", "main.py"]
