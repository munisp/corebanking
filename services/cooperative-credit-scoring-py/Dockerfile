FROM python:3.12-slim
RUN adduser --disabled-password --gecos '' appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
USER appuser
ENV PORT=8601
EXPOSE 8601
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8601/healthz')" || exit 1
CMD ["python", "main.py"]
