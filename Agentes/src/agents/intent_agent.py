"""
Intent Agent — Detección de intención y resolución.

Lee el corpus enriquecido con sentiment, reclasifica la intención
usando el catálogo ampliado, y determina resolución.

El CSV ya trae una `intencion_original` (logistica_envio, problema_pago),
pero este agente la reclasifica con mayor granularidad.

Cuando use_db=True, persiste resultados a Supabase.
"""
import asyncio
import json
import os
import re
from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path

import pandas as pd
import structlog
from pydantic import BaseModel, Field, ValidationError

from src.core.llm.client import get_llm

log = structlog.get_logger()

# ── Catálogo de intenciones (ampliado para datos reales) ─────────────────────


class IntentLabel(StrEnum):
    """Catálogo de intenciones del usuario."""

    LOGISTICA_ENVIO = "logistica_envio"
    QUEJA_SERVICIO = "queja_servicio"
    PROBLEMA_PAGO = "problema_pago"
    DEVOLUCION_REEMBOLSO = "devolucion_reembolso"
    CANCELACION_PEDIDO = "cancelacion_pedido"
    SOPORTE_TECNICO = "soporte_tecnico"
    CONSULTA_PRODUCTO = "consulta_producto"
    CAMBIO_CONTRASENA = "cambio_contrasena"
    FACTURACION = "facturacion"
    ESTADO_CUENTA = "estado_cuenta"
    OTRA = "otra"


# ── Schema de salida ─────────────────────────────────────────────────────────


class IntentResult(BaseModel):
    """Campos de intent a agregar al corpus enriquecido."""

    intent_label: IntentLabel | None = None
    intent_confidence: float | None = Field(None, ge=0.0, le=1.0)
    resolved: bool | None = None


# ── Configuración ────────────────────────────────────────────────────────────

BATCH_SIZE = int(os.getenv("INTENT_BATCH_SIZE", "50"))

# ── Prompt de clasificación ──────────────────────────────────────────────────

INTENT_PROMPT = """
Clasifica la intención de cada mensaje de soporte al cliente (ES-LATAM o PT-BR).
Catálogo: logistica_envio | queja_servicio | problema_pago | devolucion_reembolso | cancelacion_pedido | soporte_tecnico | consulta_producto | cambio_contrasena | facturacion | estado_cuenta | otra
Si confidence<0.6 usar otra. Clasificar la intención MAS URGENTE si hay varias.

Mensajes (JSON array):
{batch_json}

Responde ONLY con un JSON array del mismo tamaño, sin texto extra:
[{{"intent":"...","confidence":0.0}}, ...]
"""


# ── Clasificación con LLM ───────────────────────────────────────────────────


MINI_BATCH = int(os.getenv("INTENT_MINI_BATCH", "10"))


async def _classify_intent_batch(
    texts: list[str],
    intenciones_originales: list[str],
) -> list[IntentResult]:
    """Clasifica intent para un batch de textos usando el LLM.
    Envía MINI_BATCH mensajes por llamada para reducir uso de tokens.
    """
    llm = get_llm(role="smart")
    results: list[IntentResult] = []

    for chunk_start in range(0, len(texts), MINI_BATCH):
        chunk_texts = texts[chunk_start:chunk_start + MINI_BATCH]
        chunk_intenciones = intenciones_originales[chunk_start:chunk_start + MINI_BATCH]
        batch_items = [
            {"id": i, "text": t[:400], "intent_prev": ic}
            for i, (t, ic) in enumerate(zip(chunk_texts, chunk_intenciones))
        ]
        prompt = INTENT_PROMPT.format(batch_json=json.dumps(batch_items, ensure_ascii=False))
        try:
            response = llm.invoke(prompt)
            content = response.content if hasattr(response, "content") else str(response)
            raw = json.loads(content)
            if not isinstance(raw, list):
                raise ValueError("expected list")
            for idx_item, item in enumerate(raw):
                try:
                    intent_str = item.get("intent", "otra")
                    confidence = float(item.get("confidence", 0.5))
                    if confidence < 0.6:
                        intent_str = "otra"
                    try:
                        intent_label = IntentLabel(intent_str)
                    except ValueError:
                        intent_label = IntentLabel.OTRA
                    results.append(IntentResult(intent_label=intent_label, intent_confidence=confidence))
                except Exception:
                    fallback_intencion = chunk_intenciones[idx_item] if idx_item < len(chunk_intenciones) else "otra"
                    results.append(_fallback_from_original(fallback_intencion))
            if len(results) < chunk_start + len(chunk_texts):
                for i in range(chunk_start + len(chunk_texts) - len(results)):
                    results.append(_fallback_from_original(chunk_intenciones[i] if i < len(chunk_intenciones) else "otra"))
        except Exception as e:
            log.warning("intent_chunk_failed", error=str(e), chunk_start=chunk_start)
            for ic in chunk_intenciones:
                results.append(_fallback_from_original(ic))

    return results


def _fallback_from_original(intencion: str) -> IntentResult:
    """Genera un IntentResult de fallback basado en la intención del CSV."""
    try:
        label = IntentLabel(intencion)
    except ValueError:
        label = IntentLabel.OTRA
    return IntentResult(intent_label=label, intent_confidence=0.7)


# ── Detección de resolución ─────────────────────────────────────────────────

# Patrón de ticket/caso
_TICKET_PATTERN = re.compile(r"(#\d+|TICKET-\d+|CASO-\d+)", re.IGNORECASE)


def detect_resolved(session_turns: pd.DataFrame) -> pd.Series:
    """
    Determina si cada intención fue resuelta.

    En este dataset (solo mensajes de usuario), resolved=False cuando:
    1. nivel_frustracion llega a 2 (máximo) en la sesión
    2. es_churn_risk=True en algún turno
    3. La sesión termina con sentimiento frustrado alto
    """
    resolved = pd.Series(True, index=session_turns.index)

    for idx, row in session_turns.iterrows():
        # Si el nivel de frustración es máximo → no resuelto
        if row.get("nivel_frustracion", 0) >= 2:
            resolved.at[idx] = False
            continue

        # Si es churn risk → no resuelto
        if row.get("es_churn_risk", False):
            resolved.at[idx] = False
            continue

        # Si el sentiment_score es alto frustrado → no resuelto
        if (
            row.get("sentiment_label") == "frustrado"
            and (row.get("sentiment_score") or 0) > 0.7
        ):
            resolved.at[idx] = False

    return resolved


# ── Pipeline principal ───────────────────────────────────────────────────────


async def run_intent_analysis(
    processed_path: str,
    use_db: bool = False,
) -> str:
    """
    Clasifica intención en el corpus procesado.

    Args:
        processed_path: Path al enriched_corpus.jsonl (con sentiment).
        use_db: Si True, persiste a Supabase.

    Returns:
        Path al enriched_corpus.jsonl actualizado.
    """
    path = Path(processed_path)
    if not path.exists():
        raise FileNotFoundError(f"Corpus no encontrado: {path}")
    df = pd.read_json(path, lines=True)

    # Inicializar columnas si no existen
    if "intent_label" not in df.columns:
        df["intent_label"] = None
    if "intent_confidence" not in df.columns:
        df["intent_confidence"] = None
    if "resolved" not in df.columns:
        df["resolved"] = None

    if use_db:
        from src.db.supabase_client import get_supabase
        sb = get_supabase()
        
        session_ids = df["session_id"].unique().tolist()
        db_rows = []
        chunk_size = 100
        for i in range(0, len(session_ids), chunk_size):
            chunk = session_ids[i : i + chunk_size]
            res = sb.table("messages").select(
                "session_id,turn_id,intent_label,intent_confidence,resolved"
            ).in_("session_id", chunk).execute()
            if res.data:
                db_rows.extend(res.data)
                
        if db_rows:
            db_df = pd.DataFrame(db_rows)
            df = df.merge(db_df, on=["session_id", "turn_id"], how="left", suffixes=("_local", ""))
            for col in ["intent_label", "intent_confidence", "resolved"]:
                local_col = f"{col}_local"
                if local_col in df.columns:
                    df[col] = df[col].fillna(df[local_col])
                    df.drop(columns=[local_col], inplace=True)

    log.info("intent_starting", processed_path=str(path), rows=len(df))

    # Solo procesar filas sin label (resume desde donde se cortó)
    pending_mask = df["intent_label"].isna()
    pending_indices = df.index[pending_mask].tolist()
    already_done = len(df) - len(pending_indices)
    if already_done > 0:
        log.info("intent_resuming", already_labeled=already_done, pending=len(pending_indices))

    if pending_indices:
        texts = df.loc[pending_indices, "text_clean"].tolist()
        intenciones = (
            df.loc[pending_indices]
            .get("intencion_original", pd.Series("otra", index=pending_indices))
            .fillna("otra")
            .tolist()
        )

        output_dir_early = Path("data/processed")
        output_dir_early.mkdir(parents=True, exist_ok=True)
        _enriched_path = output_dir_early / "enriched_corpus.jsonl"

        all_results: list[IntentResult] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch_texts = texts[i : i + BATCH_SIZE]
            batch_intenciones = intenciones[i : i + BATCH_SIZE]
            batch_results = await _classify_intent_batch(batch_texts, batch_intenciones)
            all_results.extend(batch_results)
            log.info(
                "intent_batch_done",
                batch_num=i // BATCH_SIZE + 1,
                processed=already_done + len(all_results),
                total=len(df),
            )
            # Guardar progreso al final de cada batch
            batch_end = min(i + BATCH_SIZE, len(texts))
            for list_i, df_idx in enumerate(pending_indices[i:batch_end]):
                res = all_results[i + list_i]
                df.at[df_idx, "intent_label"] = (
                    res.intent_label.value if res.intent_label else None
                )
                df.at[df_idx, "intent_confidence"] = res.intent_confidence
            with open(_enriched_path, "w", encoding="utf-8") as _f:
                for _, _row in df.iterrows():
                    _f.write(json.dumps(_row.to_dict(), ensure_ascii=False, default=str) + "\n")
            log.info("intent_progress_saved", labeled=already_done + len(all_results), total=len(df))
            delay = float(os.getenv("LLM_BATCH_DELAY_SEC", "2"))
            if delay > 0 and i + BATCH_SIZE < len(texts):
                await asyncio.sleep(delay)

    # Detectar resolución por sesión
    for _, session_df in df.groupby("session_id"):
        session_idx = session_df.index
        df.loc[session_idx, "resolved"] = detect_resolved(session_df).values

    # Guardar corpus enriquecido
    output_dir = Path("data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)
    enriched_path = output_dir / "enriched_corpus.jsonl"

    with open(enriched_path, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            f.write(json.dumps(row.to_dict(), ensure_ascii=False, default=str) + "\n")

    _generate_unresolved_ranking(df, output_dir)

    if use_db:
        await _persist_intent_to_db(df)

    log.info("intent_completado", enriched_path=str(enriched_path))
    return str(enriched_path)


# ── Persistencia a Supabase ──────────────────────────────────────────────────


async def _persist_intent_to_db(df: pd.DataFrame) -> None:
    """Actualiza las columnas de intent en Supabase usando batch upsert."""
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    user_df = df[df["intent_label"].notna()].copy()

    if user_df.empty:
        return

    log.info("db_intent_updating", count=len(user_df))

    # 1. Agrupar y subir mensajes en batches
    message_rows = []
    for _, row in user_df.iterrows():
        confidence = row.get("intent_confidence")
        resolved_val = row.get("resolved")
        message_rows.append({
            "session_id": row["session_id"],
            "turn_id": int(row["turn_id"]),
            "intent_label": str(row["intent_label"]) if row.get("intent_label") else None,
            "intent_confidence": float(confidence) if confidence is not None and str(confidence) != "nan" else None,
            "resolved": bool(resolved_val) if resolved_val is not None and str(resolved_val) != "nan" else None,
        })

    batch_size = 500
    for i in range(0, len(message_rows), batch_size):
        sb.table("messages").upsert(
            message_rows[i : i + batch_size],
            on_conflict="session_id,turn_id"
        ).execute()

    # 2. Agrupar y subir sesiones en batches
    session_rows = []
    for session_id, session_df in df.groupby("session_id"):
        with_intent = session_df[session_df["intent_label"].notna()]
        if with_intent.empty:
            continue

        intent_counts = with_intent["intent_label"].value_counts()
        dominant = str(intent_counts.index[0]) if not intent_counts.empty else None

        with_resolved = with_intent[with_intent["resolved"].notna()]
        res_rate = (
            round(float(with_resolved["resolved"].mean()), 3)
            if len(with_resolved) > 0
            else None
        )

        session_rows.append({
            "id": session_id,
            "dominant_intent": dominant,
            "resolution_rate": res_rate,
        })

    session_batch_size = 200
    for i in range(0, len(session_rows), session_batch_size):
        sb.table("sessions").upsert(
            session_rows[i : i + session_batch_size],
            on_conflict="id"
        ).execute()

    log.info("db_intent_updated", messages=len(message_rows), sessions=len(session_rows))


# ── Ranking de intenciones no resueltas ──────────────────────────────────────


def _generate_unresolved_ranking(df: pd.DataFrame, output_dir: Path) -> None:
    """Genera unresolved_intents_ranking.json."""
    user_df = df[df["intent_label"].notna()].copy()

    if user_df.empty:
        ranking_data = {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "ranking": [],
        }
        with open(output_dir / "unresolved_intents_ranking.json", "w") as f:
            json.dump(ranking_data, f, indent=2, ensure_ascii=False)
        return

    ranking_items = []
    for intent_label, group in user_df.groupby("intent_label"):
        total = len(group)
        unresolved = group[group["resolved"] == False]  # noqa: E712
        unresolved_count = len(unresolved)
        unresolved_pct = round(unresolved_count / total * 100, 1) if total > 0 else 0

        avg_frustration = 0.0
        frustrated_unresolved = unresolved[unresolved.get("sentiment_label") == "frustrado"]
        if not frustrated_unresolved.empty:
            scores = frustrated_unresolved["sentiment_score"].dropna()
            avg_frustration = round(float(scores.mean()), 2) if len(scores) > 0 else 0.0

        ranking_items.append({
            "intent_label": str(intent_label),
            "total_occurrences": int(total),
            "unresolved_count": int(unresolved_count),
            "unresolved_pct": float(unresolved_pct),
            "avg_frustration_when_unresolved": float(avg_frustration),
        })

    ranking_items.sort(key=lambda x: x["unresolved_count"], reverse=True)
    ranking_items = ranking_items[:10]

    ranking_data = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "ranking": ranking_items,
    }

    json_path = output_dir / "unresolved_intents_ranking.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(ranking_data, f, indent=2, ensure_ascii=False)

    log.info("unresolved_ranking", path=str(json_path), count=len(ranking_items))
