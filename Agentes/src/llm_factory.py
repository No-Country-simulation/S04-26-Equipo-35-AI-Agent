"""
LLM Factory — Abstracción de proveedor de LLM para CrewAI 1.14+.

Desarrollo/testing: Groq (LLM_PROVIDER=groq, default)
Producción:        Anthropic (LLM_PROVIDER=anthropic)

Configuración via .env:
    LLM_FAST_PROVIDER=groq|anthropic|gemini
    LLM_FAST=<model-name>
    LLM_SMART_PROVIDER=groq|anthropic|gemini
    LLM_SMART=<model-name>
    LLM_SMART=<model-name>
"""
import os
from typing import Literal

import structlog
from crewai import LLM
from dotenv import load_dotenv

load_dotenv()
log = structlog.get_logger()

# Tipo de rol para selección de modelo
LLMRole = Literal["fast", "smart"]

# Defaults por proveedor
_DEFAULTS: dict[str, dict[str, str]] = {
    "groq": {
        "fast": "llama-3.3-70b-versatile",
        "smart": "llama-3.3-70b-versatile",
    },
    "anthropic": {
        "fast": "claude-sonnet-4-20250514",
        "smart": "claude-sonnet-4-20250514",
    },
    "gemini": {
        "fast": "gemini-2.5-flash",
        "smart": "gemini-2.5-pro",
    },
}


def _get_model_name(role: LLMRole) -> str:
    """Obtiene el nombre del modelo desde .env o usa el default."""
    env_key = "LLM_FAST" if role == "fast" else "LLM_SMART"
    provider_key = "LLM_FAST_PROVIDER" if role == "fast" else "LLM_SMART_PROVIDER"
    provider = os.getenv(provider_key, "groq")
    default = _DEFAULTS.get(provider, _DEFAULTS["groq"]).get(role, "")
    return os.getenv(env_key, default)


def _configure_litellm_retries() -> None:
    """
    Configura litellm globalmente para respetar reintentos en rate limits.

    CrewAI usa litellm internamente pero no siempre pasa los parámetros
    de retry correctamente. Configuramos litellm directamente.
    """
    try:
        import litellm

        # Activar reintentos automáticos en rate limits (429)
        litellm.num_retries = 5
        litellm.request_timeout = 120

        # Hacer que litellm espere el tiempo que Groq indica (retry-after)
        litellm.retry = True

        log.debug("litellm_retries_configured", num_retries=5, timeout=120)
    except ImportError:
        log.warning("litellm_not_installed_retries_disabled")


# Configurar retries al importar este módulo
_configure_litellm_retries()


def get_llm(role: LLMRole = "fast") -> LLM:
    """
    Retorna un objeto LLM de CrewAI con reintentos automáticos.

    Configura reintentos con espera exponencial para manejar
    los rate limits del plan gratuito de Groq (6K-12K TPM).

    Args:
        role: "fast" para volumen/velocidad, "smart" para razonamiento.

    Returns:
        Instancia de CrewAI LLM con reintentos configurados.

    Raises:
        ValueError: Si el proveedor no está soportado.
    """
    provider_key = "LLM_FAST_PROVIDER" if role == "fast" else "LLM_SMART_PROVIDER"
    provider = os.getenv(provider_key, "groq")
    model_name = _get_model_name(role)
    model_id = f"{provider}/{model_name}"

    log.debug("llm_factory", provider=provider, role=role, model=model_name)

    if provider not in ("groq", "anthropic", "gemini"):
        raise ValueError(
            f"{provider_key}='{provider}' no soportado. "
            "Usa 'groq', 'anthropic' o 'gemini'."
        )

    api_key = None
    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            os.environ["GEMINI_API_KEY"] = api_key
    elif provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            os.environ["GROQ_API_KEY"] = api_key

    return LLM(
        model=model_id,
        api_key=api_key,
        temperature=0,
        max_retries=5,        # Reintentar hasta 5 veces en rate limits
        timeout=120,          # Esperar hasta 120s por respuesta
    )
