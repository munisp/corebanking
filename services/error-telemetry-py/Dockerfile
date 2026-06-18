FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py ./
ENV PORT=8262
EXPOSE 8262
CMD ["python", "main.py"]
