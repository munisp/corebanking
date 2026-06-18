FROM python:3.12-slim
WORKDIR /app
COPY service.py .
ENV PORT=8092
EXPOSE 8092
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8092/healthz')" || exit 1
CMD ["python", "service.py"]
