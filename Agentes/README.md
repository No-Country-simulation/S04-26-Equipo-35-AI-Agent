<div align="center">

# 📊 ConversaAI — Sentiment & Intent Analysis Pipeline

**Sistema de análisis de sentimiento e intención sobre el corpus de conversaciones de soporte para identificar frustración, intenciones no resueltas y patrones de escalada o abandono.**

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Tests](https://img.shields.io/badge/tests-95%20passed-22c55e?style=flat-square)](tests/)
[![Pipeline](https://img.shields.io/badge/pipeline-Python-6366f1?style=flat-square)](/)
[![Next.js](https://img.shields.io/badge/dashboard-Next.js-000?style=flat-square&logo=next.js)](../)

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
│   ├── cli.py                   # CLI: ingest, reset-checkpoint
│   ├── pipeline/orchestrator.py # ETL → sentiment → intent → analyst
│   ├── core/llm/client.py       # LiteLLM (Groq / Gemini / Anthropic)
│   ├── agents/
│   │   ├── etl_agent.py         # Limpieza, normalización, Pydantic validation
│   │   ├── sentiment_agent.py   # Clasificación emocional + escalada + abandono
│   │   ├── intent_agent.py      # Detección de intención + resolución
│   │   └── analyst_agent.py     # Métricas, patrones, recomendaciones + Qdrant
│   ├── db/                      # 🆕 Capa de persistencia
│   │   ├── supabase_client.py   # Cliente singleton de Supabase (PostgreSQL)
│   │   ├── qdrant_store.py      # Cliente singleton de Qdrant (vectorial)
│   │   ├── embeddings.py        # Generación de embeddings via Cohere API
│   │   └── models.py            # Schemas Pydantic (referencia de tablas SQL)
│   └── tools/
│       ├── corpus_loader.py     # Carga y validación de CSV/JSONL
│       └── aggregator.py        # Agregaciones por sesión/intent/idioma
├── tests/                       # pytest (business_metrics, checkpoint, …)
├── scripts/
│   ├── generate_demo_corpus.py  # Generador de corpus sintético
│   └── setup_tables.sql         # 🆕 Creación de tablas en Supabase
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
- [Docker](https://docs.docker.com/get-docker/) (para Qdrant, solo si usas `--use-db`)

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

# 2. Ejecutar pipeline completo (modo archivos — sin DB)
uv run python -m src.cli ingest --corpus data/raw/demo_corpus.csv

# 3. Con recomendaciones inteligentes (usa LLM — requiere API credits)
uv run python -m src.cli ingest --corpus data/raw/demo_corpus.csv --smart-recommendations

# 4. Con bases de datos (Supabase + Qdrant + Cohere embeddings)
#    Requiere: SUPABASE_URL, SUPABASE_KEY, COHERE_API_KEY en .env
#    Requiere: docker compose up -d (levanta Qdrant)
uv run python -m src.cli ingest --corpus data/raw/data_conversa_ai.csv --use-db

# 5. Dashboard de producto (Next.js en la raíz del monorepo)
cd .. && npm run dev

# 6. Demo script (mini corpus + evaluate)
cd .. && ./scripts/demo.sh
```

### Tests

```bash
uv run pytest tests/ -v
```

---

## Dashboard de producto (Next.js)

El dashboard oficial está en la **raíz del monorepo** (`npm run dev`): Home KPIs, Reportes, Action Hub, carga de corpus (`/corpus/cargar`) y **Copiloto Analítico** con tools RAG.

### API de Ingesta (MLOps)
El frontend se comunica con el backend de Python a través de endpoints REST en Next.js (`src/app/api/pipeline/*`) que interactúan con Supabase para la orquestación asíncrona:
* `POST /api/pipeline/enqueue`: Recibe un archivo CSV o JSON e inicia/encola la ejecución de una etapa (ETL, sentimiento, intenciones, embeddings, analyst, o completo) utilizando un sistema de checkpoints.
* `GET /api/pipeline/status`: Obtiene el estado actual del pipeline global, el checkpoint activo y las estadísticas de mensajes almacenados en la base de datos (total de mensajes, clasificados con sentimiento, intenciones identificadas, etc.).
* `GET /api/pipeline/job/[id]`: Consulta el estado y progreso en tiempo real de un trabajo específico ( queued | processing | completed | failed ) y su posición en la cola de workers.
* `GET /api/pipeline/history`: Recupera la lista histórica de los corpus procesados históricamente con su metadato temporal y de desempeño.

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
GROQ_API_KEY=tu_api_key
LLM_SMART_PROVIDER=groq
LLM_SMART=llama-3.3-70b-versatile
LLM_BATCH_DELAY_SEC=5
LLM_CALL_DELAY_SEC=0.3
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
| Orquestación | Python asyncio (`pipeline/orchestrator`) |
| LLM | [LiteLLM](https://github.com/BerriAI/litellm) → Groq / Gemini / Anthropic |
| Dashboard | Next.js (raíz del repo) |
| Validación | Pydantic v2 |
| Procesamiento | pandas |
| Dashboard | Next.js (raíz del monorepo) |
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
