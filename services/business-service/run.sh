"""Startup script for Business Service."""
#!/bin/bash
set -e

# Change to service directory
cd "$(dirname "$0")"

# Install dependencies if not already installed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Run migrations if needed
echo "Initializing database..."
python -c "from database import init_db; init_db()"

# Start the application
echo "Starting Business Service..."
uvicorn main:app --host 0.0.0.0 --port 8086 --log-level info
