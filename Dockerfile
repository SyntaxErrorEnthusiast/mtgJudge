# Dockerfile — MTG Judge Agent backend
# Builds the FastAPI + LangGraph agent service.
# The knowledge base is built on first run via the entrypoint script.

FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY agent/ ./agent/
COPY api/ ./api/
COPY scripts/ ./scripts/

# Create data directory (ChromaDB, SQLite cache, rules hash)
RUN mkdir -p data

# Entrypoint: build knowledge base if not already built, then start API
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
