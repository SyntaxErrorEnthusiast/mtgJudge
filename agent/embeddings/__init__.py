import os

from agent.embeddings.base import EmbeddingProvider
from agent.embeddings.voyage import VoyageEmbeddingProvider

_VALID_PROVIDERS = ("voyage",)


def get_embedding_provider() -> EmbeddingProvider:
    """Factory that returns the configured embedding provider.

    Reads the EMBEDDING_PROVIDER environment variable (default: "voyage") and
    returns the corresponding provider instance.

    Raises:
        ValueError: If EMBEDDING_PROVIDER is set to an unknown value.
    """
    provider = os.environ.get("EMBEDDING_PROVIDER", "voyage")

    if provider == "voyage":
        return VoyageEmbeddingProvider()

    raise ValueError(
        f"Unknown embedding provider: {provider!r}. "
        f"Valid providers: {list(_VALID_PROVIDERS)}"
    )


__all__ = ["EmbeddingProvider", "get_embedding_provider"]
