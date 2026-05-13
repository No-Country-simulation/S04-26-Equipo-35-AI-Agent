"""
ConversaAI Insights — Dashboard Streamlit Premium.

Consume los outputs del pipeline y presenta métricas, gráficos
y recomendaciones para el product team.

Ejecutar: streamlit run dashboard/app.py
"""
import json
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

# ── Configuración de página ──────────────────────────────────────────────────

st.set_page_config(
    page_title="ConversaAI Insights",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS Premium ──────────────────────────────────────────────────────────────

st.markdown("""
<style>
    /* Dark premium theme overrides */
    .stApp {
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
    }
    [data-testid="stSidebar"] {
        background: rgba(15, 15, 26, 0.95);
        border-right: 1px solid rgba(99, 102, 241, 0.2);
    }
    [data-testid="stMetric"] {
        background: rgba(30, 30, 60, 0.6);
        border: 1px solid rgba(99, 102, 241, 0.15);
        border-radius: 12px;
        padding: 16px;
        backdrop-filter: blur(10px);
    }
    [data-testid="stMetricLabel"] {
        color: #94a3b8 !important;
        font-size: 0.85rem;
    }
    [data-testid="stMetricValue"] {
        color: #e2e8f0 !important;
        font-weight: 700;
    }
    h1, h2, h3 { color: #e2e8f0 !important; }
    .priority-card {
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 12px;
        backdrop-filter: blur(10px);
    }
    .p1-card {
        background: rgba(239, 68, 68, 0.12);
        border-left: 4px solid #ef4444;
    }
    .p2-card {
        background: rgba(245, 158, 11, 0.12);
        border-left: 4px solid #f59e0b;
    }
    .p3-card {
        background: rgba(99, 102, 241, 0.12);
        border-left: 4px solid #6366f1;
    }
    .session-user {
        background: rgba(59, 130, 246, 0.1);
        border-left: 3px solid #3b82f6;
        padding: 8px 12px;
        margin: 4px 0;
        border-radius: 0 8px 8px 0;
    }
    .session-bot {
        background: rgba(100, 116, 139, 0.1);
        border-left: 3px solid #64748b;
        padding: 8px 12px;
        margin: 4px 0;
        border-radius: 0 8px 8px 0;
    }
    .sentiment-frustrado { color: #ef4444; font-weight: 600; }
    .sentiment-neutro { color: #94a3b8; }
    .sentiment-satisfecho { color: #22c55e; font-weight: 600; }
    div[data-testid="stExpander"] {
        background: rgba(30, 30, 60, 0.4);
        border: 1px solid rgba(99, 102, 241, 0.1);
        border-radius: 12px;
    }
</style>
""", unsafe_allow_html=True)

# ── Paleta de colores ────────────────────────────────────────────────────────

COLORS = {
    "frustrado": "#ef4444",
    "neutro": "#94a3b8",
    "satisfecho": "#22c55e",
    "es": "#3b82f6",
    "pt": "#f59e0b",
    "primary": "#6366f1",
    "bg_dark": "#1a1a2e",
}

PLOTLY_TEMPLATE = "plotly_dark"

# ── Archivos requeridos ──────────────────────────────────────────────────────

REQUIRED_FILES = {
    "enriched": "data/processed/enriched_corpus.jsonl",
    "metrics": "data/processed/metrics_summary.json",
    "frustrated": "data/processed/top_frustrated_sessions.csv",
    "intents": "data/processed/unresolved_intents_ranking.json",
    "report": "reports/insights_report.md",
}


# ── Funciones de carga ───────────────────────────────────────────────────────


def check_pipeline_outputs() -> bool:
    """Verifica que todos los archivos del pipeline existen."""
    return all(Path(p).exists() for p in REQUIRED_FILES.values())


@st.cache_data
def load_enriched() -> pd.DataFrame:
    """Carga el corpus enriquecido."""
    path = Path(REQUIRED_FILES["enriched"])
    if not path.exists():
        st.error("Pipeline no ejecutado.")
        st.stop()
    return pd.read_json(path, lines=True)


@st.cache_data
def load_metrics() -> dict:
    """Carga el JSON de métricas."""
    with open(REQUIRED_FILES["metrics"]) as f:
        return json.load(f)


@st.cache_data
def load_frustrated_sessions() -> pd.DataFrame:
    """Carga el CSV de sesiones frustradas."""
    path = Path(REQUIRED_FILES["frustrated"])
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


@st.cache_data
def load_unresolved_intents() -> dict:
    """Carga el ranking de intenciones no resueltas."""
    with open(REQUIRED_FILES["intents"]) as f:
        return json.load(f)


@st.cache_data
def load_report() -> str:
    """Carga el reporte Markdown."""
    path = Path(REQUIRED_FILES["report"])
    if not path.exists():
        return "Reporte no disponible."
    return path.read_text(encoding="utf-8")


# ── Verificación de pipeline ─────────────────────────────────────────────────

if not check_pipeline_outputs():
    st.markdown("## ⚠️ Pipeline no ejecutado aún")
    st.code("python src/crew.py --corpus data/raw/demo_corpus.csv", language="bash")
    st.info("Ejecute el pipeline primero para generar los datos del dashboard.")
    st.stop()


# ── Navegación ───────────────────────────────────────────────────────────────

st.sidebar.markdown("# 📊 ConversaAI")
st.sidebar.markdown("---")
page = st.sidebar.radio(
    "Navegación",
    ["Overview", "Sesiones Frustradas", "Análisis ES vs PT", "Recomendaciones", "Reporte"],
    label_visibility="collapsed",
)


# ══════════════════════════════════════════════════════════════════════════════
# PÁGINA: Overview
# ══════════════════════════════════════════════════════════════════════════════

if page == "Overview":
    st.markdown("# 📊 ConversaAI — Dashboard de Insights")
    st.caption(f"Período: {load_metrics().get('period', 'N/A')}")

    metrics = load_metrics()
    global_m = metrics["global"]

    # Row 1: KPIs
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Sesiones", f"{global_m['total_sessions']:,}")
    with col2:
        st.metric("Tasa de Escalada", f"{global_m['escalation_rate'] * 100:.1f}%")
    with col3:
        st.metric("Tasa de Abandono", f"{global_m['abandonment_rate'] * 100:.1f}%")
    with col4:
        st.metric("Resolution Rate", f"{global_m['resolution_rate'] * 100:.1f}%")

    st.divider()

    # Row 2: Charts
    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("Top Intenciones No Resueltas")
        intents_data = load_unresolved_intents()
        if intents_data.get("ranking"):
            df_intents = pd.DataFrame(intents_data["ranking"])
            fig = px.bar(
                df_intents,
                x="unresolved_count",
                y="intent_label",
                orientation="h",
                color="unresolved_pct",
                color_continuous_scale=["#6366f1", "#ef4444"],
                labels={"unresolved_count": "No Resueltos", "intent_label": "Intención", "unresolved_pct": "% No Resuelto"},
                template=PLOTLY_TEMPLATE,
            )
            fig.update_layout(
                showlegend=False, height=400,
                yaxis={"categoryorder": "total ascending"},
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Sin datos de intenciones no resueltas.")

    with col_right:
        st.subheader("Distribución de Sentimiento")
        sentiment = global_m["sentiment_distribution"]
        fig = go.Figure(data=[go.Pie(
            labels=["Frustrado", "Neutro", "Satisfecho"],
            values=[sentiment["frustrado"], sentiment["neutro"], sentiment["satisfecho"]],
            marker_colors=[COLORS["frustrado"], COLORS["neutro"], COLORS["satisfecho"]],
            hole=0.55,
            textinfo="label+percent",
            textfont_size=13,
        )])
        fig.update_layout(
            height=400, template=PLOTLY_TEMPLATE,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            showlegend=False,
        )
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Row 3: Heatmap frustración por intent × turno
    st.subheader("Mapa de Frustración: Intención × Turno")
    df = load_enriched()
    user_frustrated = df[
        (df["speaker"] == "user")
        & (df["sentiment_label"] == "frustrado")
        & (df["intent_label"].notna())
    ]
    if not user_frustrated.empty:
        heatmap_data = (
            user_frustrated.groupby(["intent_label", "turn_id"])["sentiment_score"]
            .mean()
            .reset_index()
        )
        # Limitar turnos para visualización
        heatmap_data = heatmap_data[heatmap_data["turn_id"] <= 10]
        pivot = heatmap_data.pivot_table(
            index="intent_label", columns="turn_id",
            values="sentiment_score", fill_value=0,
        )
        fig = px.imshow(
            pivot, color_continuous_scale=["#1a1a2e", "#f59e0b", "#ef4444"],
            labels={"x": "Turno", "y": "Intención", "color": "Frustración"},
            template=PLOTLY_TEMPLATE,
        )
        fig.update_layout(
            height=350,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Sin datos de frustración por intent.")

    # Row 4: Frustración por turno en sesiones escaladas
    st.subheader("Curva de Frustración en Sesiones con Escalada")
    escalated_sessions = df[df["escalation"] == True]["session_id"].unique()  # noqa: E712
    if len(escalated_sessions) > 0:
        escalated_data = df[
            (df["session_id"].isin(escalated_sessions))
            & (df["speaker"] == "user")
            & (df["sentiment_score"].notna())
        ]
        if not escalated_data.empty:
            avg_by_turn = (
                escalated_data.groupby("turn_id")["sentiment_score"]
                .mean().reset_index()
            )
            fig = px.area(
                avg_by_turn, x="turn_id", y="sentiment_score",
                labels={"turn_id": "Turno", "sentiment_score": "Frustración Promedio"},
                template=PLOTLY_TEMPLATE,
            )
            fig.update_traces(
                fill="tozeroy",
                line_color=COLORS["frustrado"],
                fillcolor="rgba(239, 68, 68, 0.2)",
            )
            fig.update_layout(
                height=300,
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PÁGINA: Sesiones Frustradas
# ══════════════════════════════════════════════════════════════════════════════

elif page == "Sesiones Frustradas":
    st.markdown("# 😤 Sesiones con Mayor Frustración")

    frustrated_df = load_frustrated_sessions()
    df = load_enriched()

    if frustrated_df.empty:
        st.info("No hay sesiones frustradas registradas.")
        st.stop()

    # Filtros
    col_f1, col_f2 = st.columns(2)
    with col_f1:
        lang_filter = st.selectbox("Idioma", ["Todos", "es", "pt"])
    with col_f2:
        min_score = st.slider("Frustración mínima", 0.0, 1.0, 0.5, 0.05)

    filtered = frustrated_df.copy()
    if lang_filter != "Todos":
        filtered = filtered[filtered["lang"] == lang_filter]
    filtered = filtered[filtered["avg_frustration_score"] >= min_score]
    filtered = filtered.sort_values("avg_frustration_score", ascending=False)

    st.caption(f"Mostrando {len(filtered)} de {len(frustrated_df)} sesiones")

    # Tabla interactiva
    for _, row in filtered.head(30).iterrows():
        session_id = row["session_id"]
        score = row["avg_frustration_score"]
        lang = row.get("lang", "?")

        # Color del badge según score
        badge_color = "#ef4444" if score > 0.7 else "#f59e0b" if score > 0.5 else "#6366f1"

        with st.expander(
            f"🔴 {session_id}  |  Frustración: {score:.2f}  |  📍 {lang.upper()}  |  Escalaciones: {int(row.get('escalation_count', 0))}"
        ):
            session_turns = df[df["session_id"] == session_id].sort_values("turn_id")
            for _, turn in session_turns.iterrows():
                speaker = turn["speaker"]
                text = turn["text_clean"]
                sentiment = turn.get("sentiment_label", "")
                s_score = turn.get("sentiment_score")
                intent = turn.get("intent_label", "")
                resolved = turn.get("resolved")

                if speaker == "user":
                    css_class = "session-user"
                    sentiment_class = f"sentiment-{sentiment}" if sentiment else ""
                    meta = ""
                    if sentiment:
                        meta += f' <span class="{sentiment_class}">[{sentiment}'
                        if s_score is not None:
                            meta += f" {s_score:.1f}"
                        meta += "]</span>"
                    if intent:
                        meta += f" · {intent}"
                    if resolved is not None:
                        r_icon = "✅" if resolved else "❌"
                        meta += f" {r_icon}"
                else:
                    css_class = "session-bot"
                    meta = ""

                st.markdown(
                    f'<div class="{css_class}">'
                    f'<strong>{speaker.upper()}</strong>: {text}{meta}'
                    f'</div>',
                    unsafe_allow_html=True,
                )


# ══════════════════════════════════════════════════════════════════════════════
# PÁGINA: Análisis ES vs PT
# ══════════════════════════════════════════════════════════════════════════════

elif page == "Análisis ES vs PT":
    st.markdown("# 🌎 Análisis Comparativo ES vs PT")

    metrics = load_metrics()
    lang_comp = metrics.get("lang_comparison", {})
    df = load_enriched()

    if not lang_comp:
        st.warning("Datos de comparación por idioma no disponibles.")
        st.stop()

    es = lang_comp.get("es", {})
    pt = lang_comp.get("pt", {})

    # KPIs lado a lado
    col_es, col_pt = st.columns(2)
    with col_es:
        st.markdown("### 🇪🇸 Español")
        c1, c2 = st.columns(2)
        c1.metric("Sesiones", es.get("sessions", 0))
        c2.metric("Resolution Rate", f"{es.get('resolution_rate', 0) * 100:.1f}%")
        c3, c4 = st.columns(2)
        c3.metric("Escalada", f"{es.get('escalation_rate', 0) * 100:.1f}%")
        c4.metric("Abandono", f"{es.get('abandonment_rate', 0) * 100:.1f}%")

    with col_pt:
        st.markdown("### 🇧🇷 Portugués")
        c1, c2 = st.columns(2)
        c1.metric("Sesiones", pt.get("sessions", 0))
        c2.metric("Resolution Rate", f"{pt.get('resolution_rate', 0) * 100:.1f}%")
        c3, c4 = st.columns(2)
        c3.metric("Escalada", f"{pt.get('escalation_rate', 0) * 100:.1f}%")
        c4.metric("Abandono", f"{pt.get('abandonment_rate', 0) * 100:.1f}%")

    st.divider()

    # Radar chart comparativo
    st.subheader("Comparación de Métricas Clave")
    categories = ["Resolution", "Escalada", "Abandono", "Frustración"]
    es_vals = [
        es.get("resolution_rate", 0),
        es.get("escalation_rate", 0),
        es.get("abandonment_rate", 0),
        es.get("avg_frustration", 0),
    ]
    pt_vals = [
        pt.get("resolution_rate", 0),
        pt.get("escalation_rate", 0),
        pt.get("abandonment_rate", 0),
        pt.get("avg_frustration", 0),
    ]

    fig = go.Figure()
    fig.add_trace(go.Scatterpolar(
        r=es_vals + [es_vals[0]], theta=categories + [categories[0]],
        fill="toself", name="Español",
        line_color=COLORS["es"], fillcolor="rgba(59, 130, 246, 0.15)",
    ))
    fig.add_trace(go.Scatterpolar(
        r=pt_vals + [pt_vals[0]], theta=categories + [categories[0]],
        fill="toself", name="Portugués",
        line_color=COLORS["pt"], fillcolor="rgba(245, 158, 11, 0.15)",
    ))
    fig.update_layout(
        polar=dict(
            bgcolor="rgba(0,0,0,0)",
            radialaxis=dict(visible=True, range=[0, 1], gridcolor="rgba(148,163,184,0.15)"),
            angularaxis=dict(gridcolor="rgba(148,163,184,0.15)"),
        ),
        template=PLOTLY_TEMPLATE,
        paper_bgcolor="rgba(0,0,0,0)",
        height=450,
        showlegend=True,
    )
    st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Barras comparativas de sentimiento por idioma
    st.subheader("Distribución de Sentimiento por Idioma")
    user_df = df[df["speaker"] == "user"]
    sentiment_by_lang = []
    for lang_code in ["es", "pt"]:
        lang_users = user_df[user_df["lang"] == lang_code]
        if not lang_users.empty:
            counts = lang_users["sentiment_label"].value_counts(normalize=True) * 100
            for label in ["frustrado", "neutro", "satisfecho"]:
                sentiment_by_lang.append({
                    "Idioma": "Español" if lang_code == "es" else "Portugués",
                    "Sentimiento": label.capitalize(),
                    "Porcentaje": round(counts.get(label, 0), 1),
                })

    if sentiment_by_lang:
        fig = px.bar(
            pd.DataFrame(sentiment_by_lang),
            x="Sentimiento", y="Porcentaje", color="Idioma",
            barmode="group",
            color_discrete_map={"Español": COLORS["es"], "Portugués": COLORS["pt"]},
            template=PLOTLY_TEMPLATE,
        )
        fig.update_layout(
            height=350,
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PÁGINA: Recomendaciones
# ══════════════════════════════════════════════════════════════════════════════

elif page == "Recomendaciones":
    st.markdown("# 🎯 Recomendaciones para el Sprint")

    metrics = load_metrics()
    correlations = metrics.get("unresolved_intents", [])

    if not correlations:
        st.info("Sin datos de correlación intent-frustración.")
        st.stop()

    # Clasificar por prioridad
    p1, p2, p3 = [], [], []
    for m in correlations:
        pct = m.get("unresolved_pct", 0)
        frust = m.get("avg_frustration", 0)
        if pct > 40 and frust > 0.7:
            p1.append(m)
        elif 20 <= pct <= 40 or frust > 0.5:
            p2.append(m)
        else:
            p3.append(m)

    # P1 Cards
    if p1:
        st.markdown("### 🔴 P1 — Impacto Alto (resolver esta semana)")
        for m in p1[:3]:
            st.markdown(
                f'<div class="priority-card p1-card">'
                f'<strong>{m["intent_label"]}</strong><br>'
                f'📊 {m["unresolved_pct"]}% sin resolver · '
                f'😤 Frustración: {m["avg_frustration"]}<br>'
                f'<em>Acción: Rediseñar respuestas del bot para confirmar resolución explícitamente</em>'
                f'</div>',
                unsafe_allow_html=True,
            )

    # P2 Cards
    if p2:
        st.markdown("### 🟡 P2 — Impacto Medio (próximo sprint)")
        for m in p2[:5]:
            st.markdown(
                f'<div class="priority-card p2-card">'
                f'<strong>{m["intent_label"]}</strong><br>'
                f'📊 {m["unresolved_pct"]}% sin resolver · '
                f'😤 Frustración: {m["avg_frustration"]}<br>'
                f'<em>Acción: Analizar turnos previos a la frustración e identificar gaps del bot</em>'
                f'</div>',
                unsafe_allow_html=True,
            )

    # P3 Cards
    if p3:
        st.markdown("### 🔵 P3 — Backlog")
        for m in p3:
            st.markdown(
                f'<div class="priority-card p3-card">'
                f'<strong>{m["intent_label"]}</strong> — '
                f'{m["unresolved_pct"]}% sin resolver'
                f'</div>',
                unsafe_allow_html=True,
            )

    st.divider()

    # Gauge de resolution rate global
    st.subheader("Resolution Rate Global")
    global_m = metrics["global"]
    res_rate = global_m["resolution_rate"]
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=res_rate * 100,
        title={"text": "% Resuelto", "font": {"color": "#e2e8f0"}},
        number={"suffix": "%", "font": {"color": "#e2e8f0"}},
        gauge={
            "axis": {"range": [0, 100], "tickcolor": "#64748b"},
            "bar": {"color": COLORS["primary"]},
            "bgcolor": "rgba(30,30,60,0.6)",
            "steps": [
                {"range": [0, 40], "color": "rgba(239,68,68,0.2)"},
                {"range": [40, 70], "color": "rgba(245,158,11,0.2)"},
                {"range": [70, 100], "color": "rgba(34,197,94,0.2)"},
            ],
        },
    ))
    fig.update_layout(
        height=300, template=PLOTLY_TEMPLATE,
        paper_bgcolor="rgba(0,0,0,0)",
    )
    st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════════════════════════════════════
# PÁGINA: Reporte
# ══════════════════════════════════════════════════════════════════════════════

elif page == "Reporte":
    st.markdown("# 📋 Reporte de Insights")

    report = load_report()
    st.markdown(report)

    st.divider()

    col1, col2 = st.columns(2)
    with col1:
        st.download_button(
            label="📥 Descargar Reporte (Markdown)",
            data=report,
            file_name="insights_report.md",
            mime="text/markdown",
        )
    with col2:
        metrics = load_metrics()
        st.download_button(
            label="📥 Descargar Métricas (JSON)",
            data=json.dumps(metrics, indent=2, ensure_ascii=False),
            file_name="metrics_summary.json",
            mime="application/json",
        )
