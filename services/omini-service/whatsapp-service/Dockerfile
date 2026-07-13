# Python WhatsApp Service
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY whatsapp_middleware_integration.py .

# Create non-root user
RUN useradd -r -u 1000 -g root appuser && \
    chown -R appuser:root /app
USER appuser

# Expose port
EXPOSE 8105

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8105/health')" || exit 1

# Run the application
CMD ["python", "whatsapp_middleware_integration.py"]
