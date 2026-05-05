<div align="center">

# 📊 ConversaAI — Sentiment & Intent Analysis Pipeline

**Sistema de análisis de sentimiento e intención sobre el corpus de conversaciones de soporte para identificar frustración, intenciones no resueltas y patrones de escalada o abandono.**

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Tests](https://img.shields.io/badge/tests-95%20passed-22c55e?style=flat-square)](tests/)
[![CrewAI](https://img.shields.io/badge/CrewAI-multi--agent-6366f1?style=flat-square)](https://crewai.com)
[![Streamlit](https://img.shields.io/badge/dashboard-Streamlit-ef4444?style=flat-square&logo=streamlit)](dashboard/)

</div>

---

## El Problema

ConversaAI procesa más de **2 millones de mensajes al mes** en español LATAM y portugués brasileño. Actualmente se mide resolution rate, pero no se entiende el tono emocional ni si las intenciones del usuario están siendo capturadas correctamente. Esto dificulta mejorar los workflows porque **no hay datos claros sobre dónde están fallando**.

## La Solución

Un pipeline modular de 4 agentes especializados que transforma el corpus crudo de soporte en **insights accionables** para el equipo de producto:

```
CSV crudo → ETL → Sentiment → Intent → Analyst → Dashboard + Reporte
```

| Agente | Rol | Output |
|--------|-----|--------|
| **ETL** | Limpia y normaliza texto ES/PT | `processed_corpus.jsonl` |
| **Sentiment** | Clasifica emoción: frustrado / neutro / satisfecho | `enriched_corpus.jsonl` + `top_frustrated_sessions.csv` |
| **Intent** | Detecta intención y si fue resuelta | `enriched_corpus.jsonl` + `unresolved_intents_ranking.json` |
| **Analyst** | Combina todo, genera recomendaciones P1/P2/P3 | `insights_report.md` + `metrics_summary.json` |

---

## Arquitectura

```
conversa_crew/
├── src/
│   ├── crew.py                  # Orquestación secuencial de agentes
│   ├── llm_factory.py           # Abstracción Groq (dev) / Anthropic (prod)
│   ├── agents/
│   │   ├── etl_agent.py         # Limpieza, normalización, Pydantic validation
│   │   ├── sentiment_agent.py   # Clasificación emocional + escalada + abandono
│   │   ├── intent_agent.py      # Detección de intención + resolución
│   │   └── analyst_agent.py     # Métricas, patrones, recomendaciones
│   └── tools/
│       ├── corpus_loader.py     # Carga y validación de CSV/JSONL
│       └── aggregator.py        # Agregaciones por sesión/intent/idioma
├── dashboard/
│   └── app.py                   # Dashboard Streamlit (5 páginas)
├── tests/                       # 95 tests (pytest + pytest-asyncio)
├── scripts/
│   └── generate_demo_corpus.py  # Generador de corpus sintético
├── data/
│   ├── raw/                     # Corpus CSV de entrada
│   └── processed/               # Outputs del pipeline
└── reports/                     # Reporte Markdown generado
```

---

## Quick Start

### Requisitos

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (recomendado) o pip

### Instalación

```bash
git clone https://github.com/<tu-usuario>/conversa_crew.git
cd conversa_crew
uv sync
cp .env.example .env
# Editar .env con tu GROQ_API_KEY
```

### Ejecutar el Pipeline

```bash
# 1. Generar corpus de demo (500 sesiones, 2130 mensajes)
python scripts/generate_demo_corpus.py

# 2. Ejecutar pipeline completo
python src/crew.py --corpus data/raw/demo_corpus.csv

# 3. Con recomendaciones inteligentes (usa LLM — requiere API credits)
python src/crew.py --corpus data/raw/demo_corpus.csv --smart-recommendations

# 4. Abrir dashboard
streamlit run dashboard/app.py
```

### Tests

```bash
python -m pytest tests/ -v
```

---

## Dashboard (Prototipo de Referencia)

> **Nota:** El dashboard actual es un prototipo funcional que consume los outputs del pipeline. Sirve como referencia de estructura, datos disponibles y visualizaciones sugeridas para el desarrollo definitivo.

Prototipo con 5 páginas y dark theme:

| Página | Contenido |
|--------|-----------|
| **Overview** | KPIs principales, intenciones no resueltas, distribución de sentimiento, heatmap frustración × turno |
| **Sesiones Frustradas** | Top 50 sesiones con mayor frustración, explorador de conversación con sentiment coloreado |
| **Análisis ES vs PT** | Comparación lado a lado con radar chart y barras |
| **Recomendaciones** | Cards P1/P2/P3 color-coded con gauge de resolution rate |
| **Reporte** | Reporte Markdown completo con descarga |

### Datos Disponibles para el Dashboard

El pipeline genera estos archivos que el dashboard puede consumir:

```
data/processed/
├── enriched_corpus.jsonl          # Corpus completo con sentiment + intent
├── metrics_summary.json           # Métricas agregadas (KPIs, flows, abandono, ES vs PT)
├── top_frustrated_sessions.csv    # Top 50 sesiones frustradas
└── unresolved_intents_ranking.json # Ranking de intenciones no resueltas

reports/
└── insights_report.md             # Reporte Markdown para product team
```

---

## Configuración

### Variables de Entorno

```env
GROQ_API_KEY=tu_api_key        # Requerido
LLM_PROVIDER=groq               # groq (dev) | anthropic (prod)
LLM_FAST=llama-3.3-70b-versatile
LLM_SMART=qwen-qwq-32b
```

### Proveedores LLM

| Proveedor | Uso | Modelos Default |
|-----------|-----|-----------------|
| **Groq** | Desarrollo / testing | llama-3.3-70b (fast), qwen-qwq-32b (smart) |
| **Anthropic** | Producción | Claude Sonnet 4 |

---

## Métricas que Genera

| Métrica | Descripción |
|---------|-------------|
| **Tasa de escalada** | % de sesiones donde la frustración aumenta >0.3 en turnos consecutivos |
| **Tasa de abandono** | % de sesiones donde el último turno del usuario es frustrado (score >0.7) |
| **Resolution rate** | % de intenciones de usuario resueltas por el bot |
| **Distribución de sentimiento** | % frustrado / neutro / satisfecho |
| **Top intenciones no resueltas** | Ranking por frecuencia × frustración asociada |
| **Comparación ES vs PT** | Métricas por idioma para detectar diferencias regionales |

---

## Catálogo de Intenciones

| Intent | Descripción |
|--------|-------------|
| `consulta_saldo` | Saldo, crédito, deuda |
| `reporte_problema` | Error, falla, algo que no funciona |
| `solicitud_reembolso` | Devolución de dinero, cargo incorrecto |
| `cambio_datos` | Actualizar información personal |
| `consulta_estado` | Estado de pedido, reclamo, ticket |
| `queja_servicio` | Insatisfacción general, pedir agente humano |
| `solicitud_info` | Información sobre productos/servicios |
| `cancelacion` | Cancelar servicio o suscripción |
| `otra` | No encaja en categorías anteriores |

---

## Stack Técnico

| Componente | Tecnología |
|-----------|------------|
| Orquestación | [CrewAI](https://crewai.com) |
| LLM (dev) | [Groq](https://groq.com) via LangChain |
| LLM (prod) | [Anthropic](https://anthropic.com) via LangChain |
| Validación | Pydantic v2 |
| Procesamiento | pandas |
| Dashboard | Streamlit + Plotly |
| Logging | structlog |
| Tests | pytest + pytest-asyncio |
| Detección idioma | langdetect |

---

## Flujo de Uso

```
Data Analyst carga corpus del mes (CSV)
       ↓
Pipeline ETL limpia y normaliza textos
       ↓
Sentiment Agent clasifica emoción de cada turno
       ↓
Intent Agent detecta intención y resolución
       ↓
Analyst Agent genera reporte + métricas JSON
       ↓
Product Team revisa dashboard y prioriza mejoras para el sprint
```

---

## Contribución

```bash
# Instalar dependencias de desarrollo
uv sync

# Ejecutar tests antes de commit
python -m pytest tests/ -v

# Linting
ruff check src/ tests/
```

---

<div align="center">

Hecho para el equipo de producto de **ConversaAI** 🚀

</div>
