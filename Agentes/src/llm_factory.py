"""
LLM Factory — Abstracción de proveedor de LLM.

Desarrollo/testing: Groq (LLM_PROVIDER=groq, default)
Producción:        Anthropic (LLM_PROVIDER=anthropic)

Configuración via .env:
    LLM_PROVIDER=groq|anthropic
    LLM_FAST=<model-name>
    LLM_SMART=<model-name>
"""
import os
from typing import Literal

import structlog
from dotenv import load_dotenv

load_dotenv()
log = structlog.get_logger()

# Tipo de rol para selección de modelo
LLMRole = Literal["fast", "smart"]

# Defaults por proveedor
_DEFAULTS: dict[str, dict[str, str]] = {
    "groq": {
        "fast": "llama-3.3-70b-versatile",
        "smart": "qwen-qwq-32b",
    },
    "anthropic": {
        "fast": "claude-sonnet-4-20250514",
        "smart": "claude-sonnet-4-20250514",
    },
}


def _get_model_name(role: LLMRole) -> str:
    """Obtiene el nombre del modelo desde .env o usa el default."""
    env_key = "LLM_FAST" if role == "fast" else "LLM_SMART"
    provider = os.getenv("LLM_PROVIDER", "groq")
    default = _DEFAULTS.get(provider, _DEFAULTS["groq"]).get(role, "")
    return os.getenv(env_key, default)


def get_llm(role: LLMRole = "fast"):
    """
    Crea una instancia de LLM según el proveedor configurado en .env.

    Args:
        role: "fast" para volumen/velocidad, "smart" para razonamiento.

    Returns:
        Instancia de BaseChatModel (LangChain compatible).

    Raises:
        ValueError: Si el proveedor no está soportado.
        ImportError: Si la librería del proveedor no está instalada.
    """
    provider = os.getenv("LLM_PROVIDER", "groq")
    model_name = _get_model_name(role)

    log.debug("llm_factory", provider=provider, role=role, model=model_name)

    if provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(model=model_name, temperature=0)

    if provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as err:
            raise ImportError(
                "langchain-anthropic no instalado. "
                "Ejecuta: uv add langchain-anthropic"
            ) from err
        return ChatAnthropic(model=model_name, temperature=0)

    raise ValueError(
        f"LLM_PROVIDER='{provider}' no soportado. "
        "Usa 'groq' o 'anthropic'."
    )
