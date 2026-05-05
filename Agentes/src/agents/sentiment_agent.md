# SKILL — Sentiment Agent

## Responsabilidad
Clasificar el tono emocional de cada mensaje del USUARIO.
Detectar momentos de escalada emocional y riesgo de abandono.

## Regla Fundamental
**Solo clasificar turnos donde `speaker == "user"`.**
Los mensajes del bot NO tienen sentiment. Dejar campos en null para `speaker == "bot"`.

## Clasificación de Sentimiento

### Etiquetas
| Label | Descripción | Ejemplos en ES | Ejemplos en PT |
|-------|-------------|----------------|----------------|
| `frustrado` | Molestia, impaciencia, irritación | "no me entiende", "cuántas veces más", "esto no sirve", "qué malo el servicio" | "não entende nada", "que absurdo", "péssimo atendimento" |
| `neutro` | Sin carga emocional clara | "quiero saber mi saldo", "cuándo llega mi pedido" | "quero saber meu saldo", "quando chega" |
| `satisfecho` | Alivio, agradecimiento, resolución | "gracias, ya quedó", "perfecto", "funcionó" | "obrigado", "funcionou", "resolvido" |

### Score (float 0.0 - 1.0)
- Intensidad del sentimiento clasificado
- `frustrado` con score 0.9 = máxima frustración
- `neutro` con score 0.5 = completamente neutro
- No es probabilidad — es intensidad

## Flags de Detección

### `escalation: bool`
Marcar `True` cuando:
- El `sentiment_score` de frustración sube **>0.3 puntos** en 2 turnos consecutivos del mismo usuario
- El usuario usa lenguaje agresivo explícito (insultos, mayúsculas sostenidas)
- El usuario repite la misma frase >2 veces en la misma sesión

### `abandonment_risk: bool`
Marcar `True` cuando:
- El último turno del usuario tiene `sentiment_label == "frustrado"` con `sentiment_score > 0.7`
- Y no hay respuesta del usuario en los siguientes 2 turnos del bot
- O la sesión termina sin `resolved == True` en el Intent Agent

## Señales de Frustración en Español LATAM
Expresiones regionales a detectar:
- "no sirve", "no funciona", "qué mal", "pésimo"
- "ya chole" (MX), "qué mierda" (AR/BO), "qué vaina" (CO)
- Uso de MAYÚSCULAS SOSTENIDAS
- Signos repetidos: "???" "!!!"
- "llevo X horas/días esperando"
- "esto es un robo", "me están estafando"

## Señales de Frustración en Portugués Brasil
- "não funciona", "horrível", "que absurdo"
- "já faz X horas", "péssimo atendimento"
- "me enganaram", "fraude"
- CAPS LOCK, "???", "!!!"

## Output por Turno (campos a agregar al JSONL)
```json
{
  "sentiment_label": "frustrado|neutro|satisfecho|null",
  "sentiment_score": 0.85,
  "escalation": false,
  "abandonment_risk": true
}
```

## Output Adicional
Generar CSV: `data/processed/top_frustrated_sessions.csv`
Columnas: `session_id, avg_frustration_score, max_frustration_score, escalation_count, lang`
Ordenado por `avg_frustration_score` DESC. Top 50 sesiones.

## Librerías Autorizadas
```
pandas>=2.0
structlog
json (stdlib)
```
El LLM hace la clasificación — no usar TextBlob ni VADER (no entienden LATAM).
