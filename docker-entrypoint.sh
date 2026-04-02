#!/bin/sh
# docker-entrypoint.sh
# Runs the knowledge base build on first start (or if data is missing),
# then starts the FastAPI server.

set -e

echo "==> Checking knowledge base..."

if [ ! -f "data/rules_hash.txt" ]; then
  echo "==> No knowledge base found. Running initial indexing (this may take a few minutes)..."
  python scripts/refresh_rules.py
  echo "==> Knowledge base ready."
else
  echo "==> Knowledge base exists. Checking for updates..."
  python scripts/refresh_rules.py
fi

echo "==> Starting API server..."
exec uvicorn api.main:app --host 0.0.0.0 --port 8000
