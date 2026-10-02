FROM python:3.12-slim
WORKDIR /app
# W12 B5-P1-F: OpenSearch screening client module + index mapping config must
# ship in the image (opensearch_screening.py loads config/opensearch/*.json).
COPY main.py opensearch_screening.py ./
COPY config ./config
CMD ["python", "main.py"]
