import os

import voyageai

from agent.embeddings.base import EmbeddingProvider


class VoyageEmbeddingProvider(EmbeddingProvider):
    """Voyage AI embedding provider using the voyageai SDK."""

    def __init__(self) -> None:
        model = os.environ.get("EMBEDDING_MODEL", "voyage-4")
        self._model = model
        self._client = voyageai.Client()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of documents using Voyage AI."""
        result = self._client.embed(texts, model=self._model, input_type="document")
        return result.embeddings

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string using Voyage AI."""
        result = self._client.embed([text], model=self._model, input_type="query")
        return result.embeddings[0]
