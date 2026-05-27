"""
Métricas de negocio para producto — sesión e intent (no solo mensaje).

- IRR (Intent Resolution Rate) por intent a nivel sesión
- Impact score para priorización de sprint
- Repeat-intent rate (bot loop)
- Turno de quiebre (primera escalada / frustración alta)
"""
from __future__ import annotations

from typing import Any

import pandas as pd


def _session_level_df(df: pd.DataFrame) -> pd.DataFrame:
    """Una fila por sesión con métricas agregadas."""
    rows: list[dict[str, Any]] = []

    for session_id, g in df.groupby("session_id"):
        g = g.sort_values("turn_id")
        dominant = (
            g["intent_label"].mode().iloc[0]
            if g["intent_label"].notna().any()
            else (g.get("intencion_original", pd.Series("otra")).mode().iloc[0] if "intencion_original" in g else "otra")
        )
        if pd.isna(dominant):
            dominant = "otra"

        resolved_series = g["resolved"] if "resolved" in g.columns else pd.Series([True] * len(g))
        session_resolved = bool(resolved_series.eq(True).all()) if resolved_series.notna().any() else False
        if not session_resolved and resolved_series.notna().any():
            session_resolved = float(resolved_series.eq(True).mean()) >= 0.5

        scores = g["sentiment_score"].fillna(0.0) if "sentiment_score" in g.columns else pd.Series([0.0] * len(g))
        max_frust = float(scores.max())
        avg_frust = float(scores.mean())

        has_escalation = bool(g["escalation"].any()) if "escalation" in g.columns else False
        has_abandonment = bool(g["abandonment_risk"].any()) if "abandonment_risk" in g.columns else False
        churn = bool(g["es_churn_risk"].any()) if "es_churn_risk" in g.columns else False

        rows.append({
            "session_id": session_id,
            "region": g["region"].iloc[0] if "region" in g.columns else "LATAM",
            "dominant_intent": str(dominant),
            "turn_count": len(g),
            "session_resolved": session_resolved,
            "max_sentiment_score": max_frust,
            "avg_sentiment_score": avg_frust,
            "has_escalation": has_escalation,
            "has_abandonment": has_abandonment,
            "is_churn_risk": churn,
        })

    return pd.DataFrame(rows)


def calc_intent_resolution_matrix(df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    IRR y métricas por intent (nivel sesión).
    """
    sessions = _session_level_df(df)
    if sessions.empty:
        return []

    matrix: list[dict[str, Any]] = []
    for intent, group in sessions.groupby("dominant_intent"):
        total_sessions = len(group)
        resolved_sessions = int(group["session_resolved"].sum())
        irr = round(resolved_sessions / total_sessions, 3) if total_sessions > 0 else 0.0
        unresolved_pct = round((1 - irr) * 100, 1)

        avg_frustration = round(float(group["avg_sentiment_score"].mean()), 3)
        abandonment_rate = round(float(group["has_abandonment"].mean()), 3)
        escalation_rate = round(float(group["has_escalation"].mean()), 3)
        churn_rate = round(float(group["is_churn_risk"].mean()), 3)
        avg_turns = round(float(group["turn_count"].mean()), 1)

        impact_score = round(
            (total_sessions / max(len(sessions), 1))
            * (1 - irr)
            * max(avg_frustration, 0.01)
            * (1 + abandonment_rate),
            4,
        )

        matrix.append({
            "intent_label": str(intent),
            "session_count": int(total_sessions),
            "message_count": int(df[df["intent_label"] == intent].shape[0]) if "intent_label" in df.columns else 0,
            "irr": irr,
            "unresolved_pct": unresolved_pct,
            "avg_frustration": avg_frustration,
            "abandonment_rate": abandonment_rate,
            "escalation_rate": escalation_rate,
            "churn_rate": churn_rate,
            "avg_turns_per_session": avg_turns,
            "impact_score": impact_score,
        })

    matrix.sort(key=lambda x: x["impact_score"], reverse=True)
    return matrix


def calc_repeat_intent_rate(df: pd.DataFrame) -> dict[str, Any]:
    """
  Sesiones donde el usuario repite la misma intención 2+ veces (señal de loop).
    """
    repeat_sessions = 0
    total_sessions = df["session_id"].nunique()
    by_intent: dict[str, int] = {}

    for _, g in df.groupby("session_id"):
        intents = g["intent_label"].dropna().astype(str).tolist()
        if not intents:
            continue
        counts: dict[str, int] = {}
        for i in intents:
            counts[i] = counts.get(i, 0) + 1
        repeated = [k for k, v in counts.items() if v >= 2]
        if repeated:
            repeat_sessions += 1
            for intent in repeated:
                by_intent[intent] = by_intent.get(intent, 0) + 1

    rate = round(repeat_sessions / total_sessions, 3) if total_sessions > 0 else 0.0
    top = sorted(by_intent.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "repeat_intent_session_rate": rate,
        "repeat_sessions": repeat_sessions,
        "total_sessions": int(total_sessions),
        "top_intents_with_repeats": [
            {"intent_label": k, "session_count": v} for k, v in top
        ],
    }


def calc_breakpoint_turns(df: pd.DataFrame) -> dict[str, Any]:
    """
    Turno medio del primer quiebre: escalada o frustración alta (score >= 0.7).
    """
    escalation_turns: list[float] = []
    frustration_turns: list[float] = []
    by_intent_esc: dict[str, list[float]] = {}

    for session_id, g in df.groupby("session_id"):
        g = g.sort_values("turn_id")
        for idx, row in g.iterrows():
            turn = float(row.get("turn_id", 0))
            intent = str(row.get("intent_label") or "otra")

            if row.get("escalation") is True:
                escalation_turns.append(turn)
                by_intent_esc.setdefault(intent, []).append(turn)
                break

        for idx, row in g.iterrows():
            turn = float(row.get("turn_id", 0))
            if (
                row.get("sentiment_label") == "frustrado"
                and float(row.get("sentiment_score") or 0) >= 0.7
            ):
                frustration_turns.append(turn)
                break

    def _avg(vals: list[float]) -> float | None:
        return round(sum(vals) / len(vals), 1) if vals else None

    intent_breakpoints = [
        {
            "intent_label": intent,
            "avg_escalation_turn": _avg(turns),
            "sessions_with_escalation": len(turns),
        }
        for intent, turns in by_intent_esc.items()
    ]
    intent_breakpoints.sort(
        key=lambda x: x["avg_escalation_turn"] or 999,
    )

    return {
        "avg_turn_first_escalation": _avg(escalation_turns),
        "avg_turn_high_frustration": _avg(frustration_turns),
        "sessions_with_escalation": len(escalation_turns),
        "sessions_with_high_frustration": len(frustration_turns),
        "by_intent_escalation": intent_breakpoints[:10],
    }


def get_top_priority_flows(
    intent_matrix: list[dict[str, Any]],
    n: int = 3,
) -> list[dict[str, Any]]:
    """Top N flujos a atacar esta semana (producto)."""
    return intent_matrix[:n]


def prioritize_by_impact(
    intent_matrix: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """P1/P2/P3 por impact_score y umbrales de negocio."""
    p1: list[dict[str, Any]] = []
    p2: list[dict[str, Any]] = []
    p3: list[dict[str, Any]] = []

    for row in intent_matrix:
        irr = row.get("irr", 1)
        frust = row.get("avg_frustration", 0)
        unres = row.get("unresolved_pct", 0)
        impact = row.get("impact_score", 0)

        if (unres > 40 and frust > 0.55) or impact >= 0.15:
            p1.append(row)
        elif unres > 20 or frust > 0.45 or impact >= 0.08:
            p2.append(row)
        else:
            p3.append(row)

    return {"P1": p1[:3], "P2": p2[:5], "P3": p3}


def build_business_metrics(df: pd.DataFrame) -> dict[str, Any]:
    """Paquete completo para metrics_json v2."""
    intent_matrix = calc_intent_resolution_matrix(df)
    return {
        "intent_matrix": intent_matrix,
        "top_priority_flows": get_top_priority_flows(intent_matrix, 3),
        "repeat_intent": calc_repeat_intent_rate(df),
        "breakpoints": calc_breakpoint_turns(df),
        "priorities": prioritize_by_impact(intent_matrix),
    }
