FROM python:3.12-slim
RUN adduser --disabled-password --gecos '' appuser
WORKDIR /app
COPY requirements.txt .
COPY main.py .
USER appuser
ENV PORT=8594
EXPOSE 8594
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8594/healthz')" || exit 1
CMD ["python", "main.py"]
