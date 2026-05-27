# Plan: Pestaña Reportes — Lenguaje PM

## Objetivo
Reemplazar el lenguaje técnico (P1/P2/P3, "intent", "loop", "IRR") por lenguaje
que usa un equipo de Product Management. Las recomendaciones las genera el
Analyst Agent → frontend las muestra. Ambas capas deben hablar el mismo idioma.

---

## Capa 1 — Frontend (`src/`)

### 1. `src/lib/report-insights.ts`
- **Tipo `Recommendation.priority`**: `"P1" | "P2" | "P3"` → `"crítico" | "alto" | "oportunidad"`
- **Tipo `Recommendation.category`**: renombrar valores técnicos:
  | Actual | PM |
  |---|---|
  | `loop` | `friccion_repetida` |
  | `escalation` | `escalada` |
  | `frustration` | `experiencia` |
  | `intent_coverage` | `cobertura` |
  | `bot_design` | `diseno_experiencia` |
- **`generateRecommendations()`**: cambiar prioridades asignadas:
  - `"P1"` → `"crítico"`, `"P2"` → `"alto"`, `"P3"` → `"oportunidad"`
- **`recs.sort()`**: ordenar por `"crítico" > "alto" > "oportunidad"`

### 2. `src/components/report-business-section.tsx`
- **`P_COLOR`**: remap de `P1/P2/P3` → `crítico/alto/oportunidad`
- **`CAT_LABEL`**: traducir a lenguaje PM:
  | Actual | PM |
  |---|---|
  | `loop` → "Loop del bot" | `friccion_repetida` → "Fricción repetida" |
  | `escalation` → "Escalada" | `escalada` → "Escalada a agente humano" |
  | `frustration` → "Frustración" | `experiencia` → "Experiencia del cliente" |
  | `intent_coverage` → "Cobertura de intent" | `cobertura` → "Cobertura de solicitudes" |
  | `bot_design` → "Diseño del bot" | `diseno_experiencia` → "Diseño de la experiencia" |
- **Badge de prioridad**: en lugar de "P1" mostrar "Crítico", "P2" → "Alta prioridad", "P3" → "Oportunidad"
- **Columna "Intención"** en la matriz → "Solicitud del cliente"
- **Columna "IRR"** → "Tasa de resolución"
- **Título "Loops del bot"** → "Clientes que repiten su consulta sin resolver"
- **"Momento de quiebre"** → "¿Cuándo se pierde al cliente?"
- **"primera escalada"** → "primera vez que pide hablar con una persona"
- **"frustración alta"** → "momento de mayor malestar detectado"

### 3. `src/components/reportes-page.tsx`
- Sección "Business insights" → "Análisis del comportamiento del cliente"
- Subtitle del reporte: ya está bien, solo verificar

---

## Capa 2 — Analyst Agent (`Agentes/`)

### 4. Buscar dónde el agente genera recomendaciones
- Buscar en `Agentes/` archivos que generen `recommendations`, `priority`, `P1`, `P2`
- Si el agente guarda recomendaciones en `metrics_json` → actualizarlas también
- Si el agente no genera recomendaciones (solo datos) → solo tocar el frontend ✅

### 5. Verificar estructura de `metrics_json` en Supabase
- El campo `business.recommendations` en `metrics_snapshots` puede tener `P1/P2/P3`
  guardados desde corridas anteriores
- Si es así: migrar o ignorar (el frontend `generateRecommendations()` los regenera
  desde los datos crudos, no desde el JSON guardado)

---

## Orden de ejecución sugerido

1. [ ] Revisar Agentes/ para confirmar si guarda recomendaciones (15 min)
2. [ ] Actualizar tipos y lógica en `report-insights.ts` (20 min)
3. [ ] Actualizar labels en `report-business-section.tsx` (20 min)
4. [ ] Verificar render en /reportes (10 min)
5. [ ] Si el agente guarda recs: actualizar allí también (20 min)

---

## Estado actual (antes de empezar)
- `P_COLOR` usa `P1/P2/P3` como claves → badge muestra "P1", "P2", "P3"
- `CAT_LABEL` tiene términos técnicos de NLP
- La matriz muestra columna "Intención" e "IRR" sin contexto para un PM
- El agente probablemente solo guarda datos crudos (la función `generateRecommendations`
  está 100% en el frontend)
