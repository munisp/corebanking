# 54Bank — ML Inference Server
FROM python:3.12-slim
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir numpy deltalake pyarrow
WORKDIR /app
COPY ml/ /app/ml/
ENV PYTHONPATH=/app
EXPOSE 8500 8501
CMD ["python3", "-m", "ml.inference.server"]
