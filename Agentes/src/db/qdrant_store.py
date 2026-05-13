"""
Qdrant Client — Singleton de conexión a Qdrant (base de datos vectorial).

Uso:
    from src.db.qdrant_client import get_qdrant, COLLECTION_NAME

    client = get_qdrant()
    client.search(collection_name=COLLECTION_NAME, query_vector=vector, limit=10)
"""
import os
from functools import lru_cache

import structlog
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

load_dotenv()
log = structlog.get_logger()

# Nombre de la colección donde se almacenan los embeddings de mensajes
COLLECTION_NAME = "conversaai_messages"

# Dimensión del vector de Cohere embed-multilingual-v3.0 = 1024
VECTOR_DIMENSION = 1024


@lru_cache(maxsize=1)
def get_qdrant() -> QdrantClient:
    """
    Crea y retorna un cliente singleton de Qdrant.

    Configuración via .env (opcionales, con defaults para Docker local):
        QDRANT_HOST=localhost
        QDRANT_PORT=6333

    Returns:
        Cliente de Qdrant listo para usar.
    """
    host = os.getenv("QDRANT_HOST", "localhost")
    port = int(os.getenv("QDRANT_PORT", "6333"))

    client = QdrantClient(host=host, port=port)
    log.info("qdrant_connected", host=host, port=port)

    return client


def ensure_collection_exists(client: QdrantClient | None = None) -> None:
    """
    Crea la colección de vectores si no existe.

    Usa Distance.COSINE, optimizada para búsqueda semántica con Cohere embeddings.
    """
    if client is None:
        client = get_qdrant()

    collections = [c.name for c in client.get_collections().collections]

    if COLLECTION_NAME not in collections:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_DIMENSION,
                distance=Distance.COSINE,
            ),
        )
        log.info(
            "qdrant_collection_created",
            name=COLLECTION_NAME,
            dimension=VECTOR_DIMENSION,
        )
    else:
        log.info("qdrant_collection_exists", name=COLLECTION_NAME)
