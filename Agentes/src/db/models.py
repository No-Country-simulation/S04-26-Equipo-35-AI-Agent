"""
Models — Definición de tablas esperadas en Supabase y helpers de SQL.

Estas clases NO crean tablas automáticamente. Las tablas deben ser creadas
en el panel de Supabase (SQL Editor) usando el script `setup_tables.sql`.

Aquí se definen los schemas de datos como referencia y para validación.

NOTA: El CSV real (data_conversa_ai.csv) tiene esta estructura:
  session_id, usuario, fecha, region, intencion, nivel_frustracion,
  texto_espanol, texto_portugues, es_churn_risk

No tiene columnas 'speaker' ni 'text'. Los textos son bilingües paralelos
y la intención/frustración ya vienen pre-clasificadas en el CSV.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Tabla: sessions ──────────────────────────────────────────────────────────


class SessionRow(BaseModel):
    """Schema de la tabla `sessions` en Supabase."""

    id: str = Field(..., description="ID único de sesión (ej: SESS-14614)")
    usuario: str | None = Field(None, description="Handle del usuario (ej: @miniKittyLuna)")
    region: Literal["LATAM", "BRAZIL", "EUROPE"] | None = None
    total_turns: int = Field(0, description="Número total de turnos")
    created_at: datetime | None = None

    # Métricas agregadas (se llenan después del análisis)
    avg_frustration_score: float | None = None
    max_frustration_score: float | None = None
    has_escalation: bool = False
    has_abandonment: bool = False
    dominant_intent: str | None = None
    resolution_rate: float | None = None
    is_churn_risk: bool = False


# ── Tabla: messages ──────────────────────────────────────────────────────────


class MessageRow(BaseModel):
    """Schema de la tabla `messages` en Supabase."""

    id: int | None = Field(None, description="Auto-generado por Supabase")
    session_id: str = Field(..., description="FK a sessions.id")
    turn_id: int = Field(..., description="Número de turno en la sesión")
    fecha: datetime | None = None
    region: Literal["LATAM", "BRAZIL", "EUROPE"] | None = None

    # Textos originales bilingües del CSV
    texto_espanol: str | None = None
    texto_portugues: str | None = None
    text_clean: str | None = Field(None, description="Texto limpio por ETL agent")

    # Datos originales del CSV
    intencion_original: str | None = Field(
        None, description="Intención del CSV (logistica_envio, problema_pago)"
    )
    nivel_frustracion: int | None = Field(
        None, ge=0, le=2, description="0=bajo, 1=medio, 2=alto"
    )
    es_churn_risk: bool = False

    # Campos de Sentiment Agent (null hasta que se procese)
    sentiment_label: Literal["frustrado", "neutro", "satisfecho"] | None = None
    sentiment_score: float | None = Field(None, ge=0.0, le=1.0)
    escalation: bool = False
    abandonment_risk: bool = False

    # Campos de Intent Agent (null hasta que se procese)
    intent_label: str | None = None
    intent_confidence: float | None = Field(None, ge=0.0, le=1.0)
    resolved: bool | None = None

    # Referencia a Qdrant (null si no se ha vectorizado)
    qdrant_point_id: str | None = Field(
        None, description="UUID del punto en Qdrant"
    )


# ── Tabla: pipeline_runs ─────────────────────────────────────────────────────


class PipelineRunRow(BaseModel):
    """Schema de la tabla `pipeline_runs` para auditoría."""

    id: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    corpus_file: str = ""
    total_messages: int = 0
    total_sessions: int = 0
    status: Literal["running", "completed", "failed"] = "running"
    error_message: str | None = None


# ── Tabla: metrics_snapshots ─────────────────────────────────────────────────


class MetricsSnapshotRow(BaseModel):
    """Schema para snapshots mensuales de métricas (tabla `metrics_snapshots`)."""

    id: int | None = None
    period: str = Field(..., description="Período YYYY-MM")
    created_at: datetime | None = None
    metrics_json: dict = Field(
        default_factory=dict,
        description="JSON completo de metrics_summary",
    )
