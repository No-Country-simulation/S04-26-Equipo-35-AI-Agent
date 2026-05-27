"""
Cliente LLM unificado vía LiteLLM (sin CrewAI).

Configuración (.env):
    LLM_FAST_PROVIDER / LLM_SMART_PROVIDER: groq | gemini | anthropic
    LLM_FAST / LLM_SMART: nombre del modelo
    GROQ_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Literal

import structlog
from dotenv import load_dotenv

load_dotenv()
log = structlog.get_logger()

LLMRole = Literal["fast", "smart"]

_DEFAULTS: dict[str, dict[str, str]] = {
    "groq": {
        "fast": "llama-3.1-8b-instant",
        "smart": "llama-3.1-8b-instant",
    },
    "anthropic": {
        "fast": "claude-sonnet-4-20250514",
        "smart": "claude-sonnet-4-20250514",
    },
    "gemini": {
        "fast": "gemini-2.5-flash",
        "smart": "gemini-2.5-flash",
    },
}


def _configure_litellm() -> None:
    try:
        import litellm

        litellm.num_retries = 5
        litellm.request_timeout = 120
        litellm.retry = True
    except ImportError:
        log.warning("litellm_not_installed")


_configure_litellm()


def _model_id(role: LLMRole) -> str:
    env_key = "LLM_FAST" if role == "fast" else "LLM_SMART"
    provider_key = "LLM_FAST_PROVIDER" if role == "fast" else "LLM_SMART_PROVIDER"
    provider = os.getenv(provider_key, "groq")
    if provider not in _DEFAULTS:
        raise ValueError(f"{provider_key}='{provider}' no soportado.")
    default = _DEFAULTS[provider][role]
    model_name = os.getenv(env_key, default)
    return f"{provider}/{model_name}"


@dataclass
class LLMResponse:
    content: str


class LLMClient:
    """Wrapper mínimo compatible con el antiguo `llm.invoke(prompt)`."""

    def __init__(self, role: LLMRole = "smart") -> None:
        self.role = role
        self.model = _model_id(role)

    def invoke(self, prompt: str) -> LLMResponse:
        import litellm

        provider = self.model.split("/", 1)[0]
        if provider == "gemini":
            key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if key:
                os.environ["GEMINI_API_KEY"] = key
        elif provider == "groq" and os.getenv("GROQ_API_KEY"):
            pass

        log.debug("llm_invoke", model=self.model, role=self.role)
        max_retries = int(os.getenv("LLM_MAX_RETRIES", "6"))
        base_wait = float(os.getenv("LLM_RETRY_BASE_SEC", "2"))

        last_err: Exception | None = None
        for attempt in range(max_retries):
            try:
                response = litellm.completion(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                )
                content = response.choices[0].message.content or ""
                return LLMResponse(content=content.strip())
            except Exception as e:
                last_err = e
                err = str(e).lower()
                rate_limited = (
                    "429" in str(e)
                    or "rate_limit" in err
                    or "resource_exhausted" in err
                    or type(e).__name__ == "RateLimitError"
                )
                if not rate_limited or attempt >= max_retries - 1:
                    raise
                wait = min(60.0, base_wait * (2**attempt))
                log.warning(
                    "llm_rate_limited_retry",
                    model=self.model,
                    attempt=attempt + 1,
                    wait_sec=wait,
                )
                time.sleep(wait)

        if last_err:
            raise last_err
        raise RuntimeError("llm_invoke_failed")


def get_llm(role: LLMRole = "smart") -> LLMClient:
    return LLMClient(role=role)
