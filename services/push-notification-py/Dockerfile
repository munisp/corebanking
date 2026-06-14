FROM python:3.12-slim AS builder
WORKDIR /app
COPY main.py .
RUN python -m py_compile main.py

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app/main.py .
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')"
CMD ["python", "main.py"]
