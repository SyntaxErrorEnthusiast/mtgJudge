import os

from agent.embeddings.base import EmbeddingProvider
from agent.embeddings.voyage import VoyageEmbeddingProvider

_VALID_PROVIDERS = ("voyage",)

_provider_instance: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    """Return a cached singleton embedding provider instance.

    Reads the EMBEDDING_PROVIDER environment variable (default: "voyage") and
    returns the corresponding provider instance, creating it once on first call.

    Raises:
        ValueError: If EMBEDDING_PROVIDER is set to an unknown value.
    """
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    provider = os.environ.get("EMBEDDING_PROVIDER", "voyage")

    if provider == "voyage":
        _provider_instance = VoyageEmbeddingProvider()
        return _provider_instance

    raise ValueError(
        f"Unknown embedding provider: {provider!r}. "
        f"Valid providers: {list(_VALID_PROVIDERS)}"
    )


__all__ = ["EmbeddingProvider", "get_embedding_provider"]
