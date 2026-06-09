FROM python:3.12-slim
WORKDIR /app
COPY main.py .
EXPOSE 8113
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8113/healthz')" || exit 1
CMD ["python", "main.py"]
