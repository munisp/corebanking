FROM python:3.11-slim
WORKDIR /app
COPY service.py .
EXPOSE 8100
RUN adduser -D -u 1001 appuser
USER appuser
HEALTHCHECK --interval=30s --timeout=5s CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/healthz')" || exit 1
CMD ["python", "service.py"]
