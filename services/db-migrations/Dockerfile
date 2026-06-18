FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:9345/healthz || exit 1
ENTRYPOINT ["python", "migrate.py"]
