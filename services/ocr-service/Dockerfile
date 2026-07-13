# Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    libxcb1 libxcb-render0 libxcb-shm0 libxcb-xfixes0 \
    libglib2.0-0 libsm6 libxext6 libxrender1 \
    libgl1 libglx-mesa0 \
    libgomp1 \
    tesseract-ocr tesseract-ocr-eng \
    poppler-utils \
    fonts-liberation \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . /app/

# Expose the port your Flask app runs on
EXPOSE 80

# Command to run the FastAPI app with Uvicorn (ASGI server)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
