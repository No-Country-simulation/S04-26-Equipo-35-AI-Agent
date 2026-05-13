"""
Embeddings — Generación de vectores via Cohere API.

Usa el modelo `embed-multilingual-v3.0` de Cohere para generar embeddings
de textos en ES LATAM y PT-BR. Todo el procesamiento ocurre en los servidores
de Cohere (zero local compute).

Uso:
    from src.db.embeddings import embed_texts

    vectors = embed_texts(["hola mundo", "bom dia"])
    # vectors[0] -> [0.023, -0.119, ...] (1024 dimensiones)
"""
import os
from typing import Literal

import cohere
import structlog
from dotenv import load_dotenv

load_dotenv()
log = structlog.get_logger()

# Modelo de Cohere para embeddings multilingües
MODEL_NAME = "embed-multilingual-v3.0"

# Dimensión de salida del modelo
EMBEDDING_DIMENSION = 1024

# Batch máximo que acepta Cohere en una sola llamada
MAX_BATCH_SIZE = 96

# Tipo de input para Cohere
InputType = Literal[
    "search_document",  # para almacenar documentos
    "search_query",     # para queries de búsqueda
]


def _get_cohere_client() -> cohere.ClientV2:
    """Crea un cliente de Cohere. Requiere COHERE_API_KEY en .env."""
    api_key = os.getenv("COHERE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "COHERE_API_KEY es requerida en .env. "
            "Obtén una gratis en https://dashboard.cohere.com/api-keys"
        )
    return cohere.ClientV2(api_key=api_key)


def embed_texts(
    texts: list[str],
    input_type: InputType = "search_document",
) -> list[list[float]]:
    """
    Genera embeddings para una lista de textos usando Cohere.

    Args:
        texts: Lista de textos a vectorizar.
        input_type: "search_document" para almacenar,
                    "search_query" para buscar.

    Returns:
        Lista de vectores, cada uno con 1024 dimensiones.

    Raises:
        RuntimeError: Si COHERE_API_KEY no está configurada.
    """
    if not texts:
        return []

    client = _get_cohere_client()
    all_embeddings: list[list[float]] = []

    # Procesar en batches de MAX_BATCH_SIZE
    for i in range(0, len(texts), MAX_BATCH_SIZE):
        batch = texts[i : i + MAX_BATCH_SIZE]

        response = client.embed(
            texts=batch,
            model=MODEL_NAME,
            input_type=input_type,
            embedding_types=["float"],
        )

        # Extraer los vectores float de la respuesta
        batch_embeddings = response.embeddings.float_
        all_embeddings.extend(batch_embeddings)

        log.debug(
            "embeddings_batch_done",
            batch_num=i // MAX_BATCH_SIZE + 1,
            processed=len(all_embeddings),
            total=len(texts),
        )

    log.info("embeddings_generated", count=len(all_embeddings))
    return all_embeddings


def embed_query(query: str) -> list[float]:
    """
    Genera un embedding para una query de búsqueda semántica.

    Usa input_type="search_query" para optimizar la similitud
    contra documentos almacenados con input_type="search_document".

    Args:
        query: Texto de la query de búsqueda.

    Returns:
        Vector de 1024 dimensiones.
    """
    result = embed_texts([query], input_type="search_query")
    return result[0]
