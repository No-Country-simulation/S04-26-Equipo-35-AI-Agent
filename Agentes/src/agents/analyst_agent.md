# SKILL — Analyst Agent

## Responsabilidad
Combinar outputs de Sentiment Agent e Intent Agent.
Identificar patrones accionables y generar recomendaciones priorizadas para el product team.

## Inputs Esperados
- `data/processed/enriched_corpus.jsonl` (con todos los campos de sentiment e intent)
- `data/processed/top_frustrated_sessions.csv`
- `data/processed/unresolved_intents_ranking.json`

## Análisis Obligatorios (en orden)

### 1. Métricas Globales del Mes
Calcular y reportar:
- Total sesiones analizadas
- Tasa de escalada: `sesiones con escalation=True / total sesiones`
- Tasa de abandono: `sesiones con abandonment_risk=True / total sesiones`
- Resolution rate general: `turnos con resolved=True / total turnos de usuario`
- Distribución de sentimiento: % frustrado / neutro / satisfecho
- Distribución ES vs PT

### 2. Top Flujos con Mayor Frustración
Identificar los 5 workflows del bot donde la frustración es mayor:
- Agrupar por `intent_label` + patrón de respuesta del bot
- Calcular `avg_sentiment_score` para `frustrado` por flujo
- Identificar el turno exacto donde comienza la escalada

### 3. Correlación Intent No Resuelto → Frustración
- ¿Qué intenciones no resueltas generan mayor frustración?
- Correlación entre `resolved=False` y `sentiment_label=frustrado`
- Ranking: intent + unresolved_pct + avg_frustration

### 4. Patrones de Abandono
- ¿En qué turno del workflow el usuario abandona más frecuentemente?
- ¿Qué intención tenía cuando abandonó?
- ¿Hay diferencia entre ES y PT en patrones de abandono?

### 5. Análisis por Idioma
- Comparar métricas clave entre ES y PT
- ¿Algún idioma tiene peor resolution rate?
- ¿Las intenciones no resueltas difieren por idioma?

## Formato del Reporte (Markdown)

El reporte se guarda en `reports/insights_report.md` con esta estructura exacta:

```markdown
# ConversaAI — Insights Report
**Período:** [mes/año]  
**Generado:** [fecha]

## Métricas Clave del Mes
| Métrica | Valor |
|---------|-------|
| Total sesiones | X |
| Tasa de escalada | X% |
| ...

## Top 5 Flujos con Mayor Frustración
### 1. [Nombre del flujo]
- **Intención:** X
- **Frustración promedio:** X
- **Momento de escalada:** Turno X
- **Evidencia:** Fragmento de conversación representativa

## Top 10 Intenciones No Resueltas
| Rank | Intención | Ocurrencias | % No Resuelto | Frustración Asociada |
|------|-----------|-------------|---------------|----------------------|

## Patrones de Abandono
...

## Diferencias ES vs PT
...

## Recomendaciones para el Sprint
### P1 — Impacto Alto (resolver esta semana)
1. [Recomendación] — **Impacto estimado:** X% reducción de frustración
   - Acción concreta: ...
   - Métrica de éxito: ...

### P2 — Impacto Medio (próximo sprint)
...

### P3 — Backlog
...
```

## Criterios de Priorización de Recomendaciones
- **P1**: Intent con >40% unresolved rate Y >0.7 avg frustration
- **P2**: Intent con 20-40% unresolved rate O >0.5 avg frustration
- **P3**: Todo lo demás

## Reglas para Recomendaciones
- Cada recomendación debe ser **concreta y ejecutable** en 1-2 semanas
- Incluir **métrica de éxito medible** para verificar mejora el siguiente mes
- Máximo 3 recomendaciones P1, 5 P2, backlog libre
- No recomendar "mejorar el bot en general" — ser específico por flujo/intent

## Output Final
- `reports/insights_report.md` — reporte completo para product team
- `data/processed/metrics_summary.json` — métricas en JSON para el dashboard
