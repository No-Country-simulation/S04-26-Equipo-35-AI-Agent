# Plan de implementación — ConversaAI (2 semanas)

Alineado al brief: pipeline ES/PT, sentiment/intent, dashboard, informe accionable, copiloto con RAG agéntico, UX para equipo de producto.

**Arquitectura objetivo:** Python pipeline batch → Supabase + Qdrant → Next.js (dashboard + copiloto agéntico). Sin CrewAI.

---

## Semana 1 — Datos fiables y pipeline profesional

### Día 1–2 · Fundación (Fase 0)
- [x] Eliminar CrewAI (`crew.py`, deps)
- [x] `src/core/llm/client.py` (LiteLLM)
- [x] `src/pipeline/orchestrator.py` + `checkpoint.py`
- [x] CLI: `uv run python -m src.cli ingest --corpus ... --use-db`
- [x] Unificar persistencia DB (`writer.py` + `repository.py` legacy)
- [x] `pipeline_runs` en Supabase al iniciar/finalizar ingesta

### Día 3–4 · Analyst de negocio (Fase 1b)
- [x] `src/analytics/business_metrics.py`: IRR por intent, impact score, repeat-intent, turno de quiebre
- [x] Schema `metrics_json` v2 en `metrics_snapshots`
- [x] User stories ordenadas por impacto
- [x] Corregir filtros región en `src/lib/api.ts` (`LATAM` no `MEXICO`)

### Día 5 · Ingesta corpus real (al final)
- [x] Correr ingesta completa `data_conversa_ai.csv`
- [x] Validar dashboard con datos reales
- [x] Script `evaluate` (`uv run python -m src.cli evaluate --corpus ...`)

**Checklist ingesta (CLI):**
```bash
# 1. Qdrant
docker compose -f docker-compose.yml up -d

# 2. Agentes/.env — para ~20k filas usar Groq en smart (evita 429 Gemini):
# LLM_SMART_PROVIDER=groq
# LLM_SMART=llama-3.3-70b-versatile
# LLM_BATCH_DELAY_SEC=2

cd Agentes
uv run python -m src.cli reset-checkpoint
uv run python -m src.cli ingest \
  --corpus data/raw/data_conversa_ai.csv \
  --use-db \
  --smart-recommendations
```

Tras `completed`: `evaluate --corpus ...`, `npm run dev`, probar `/` y copiloto `search_conversations`.
Alternativa UI: `/corpus/cargar` → subir CSV → iniciar pipeline.

---

## Semana 2 — Producto, copiloto y UX

### Día 6–7 · API ingesta + UI MLOps (Fase 2)
- [x] `POST /api/pipeline/start` + `GET /api/pipeline/status`
- [x] Reemplazar mock en `corpus-upload-page.tsx`
- [x] Estados: idle | running | rate_limited | completed | failed

### Día 8–9 · Copiloto RAG agéntico (Fase 3)
- [x] Tools en `/api/chat`: `get_global_kpis`, `get_intent_matrix`, `get_frustrated_sessions`, `search_conversations` (Qdrant + Cohere query embed)
- [x] `maxSteps` 5, system prompt “usa tools antes de afirmar”
- [x] Variables documentadas en `.env.example` (raíz)

### Día 10 · Rediseño UX producto (Fase 4)
- [x] Design system: tokens en `theme.css` (product accent, surfaces)
- [x] **Home:** KPIs + “3 flujos a atacar esta semana” (`PriorityFlowsPanel`)
- [x] **Reportes:** matriz IRR, quiebre, loops (`ReportBusinessSection`)
- [x] **Action Hub:** impacto, orden, VoC + copiloto integrado
- [x] Copiloto: panel consistente, sugerencias de preguntas, citas `session_id`
- [x] Accesibilidad: contraste, focus, responsive

### Día 11–12 · Cierre y demo
- [x] Tests pytest pipeline + smoke Next build
- [x] README raíz + `Agentes/README` actualizados
- [x] Demo script: carga mini corpus → dashboard → copiloto
- [x] Deprecar Streamlit si Next es definitivo

---

## Definition of Done (brief)

1. Analista carga CSV y ve progreso real hasta `completed`.
2. Mensajes en Supabase con sentiment, intent, flags.
3. Embeddings en Qdrant.
4. Dashboard: top intents no resueltos + frustración + matrices de impacto.
5. Informe + user stories P1/P2/P3 con métrica de éxito.
6. Copiloto agéntico con búsqueda en conversaciones.
7. Sin CrewAI en el repo.

---

## Roles → pantallas

| Rol | Pantalla principal |
|-----|-------------------|
| Data Analyst | Cargar corpus / CLI |
| Product Manager | Home + Action Hub + Copiloto |
| Conversation Design | Reportes + VoC + Copiloto search |
