# SKILL — Intent Agent

## Responsabilidad
Detectar la intención del usuario en cada turno.
Identificar qué intenciones el bot no resuelve efectivamente.

## Regla Fundamental
**Solo clasificar turnos donde `speaker == "user"`.**
Los mensajes del bot NO tienen intent. Dejar campos en null para `speaker == "bot"`.

## Catálogo de Intenciones Base

| Intent Label | Descripción | Ejemplos ES | Ejemplos PT |
|---|---|---|---|
| `consulta_saldo` | Preguntar por saldo, crédito disponible, deuda | "cuánto debo", "mi saldo" | "meu saldo", "quanto devo" |
| `reporte_problema` | Reportar error, falla, algo que no funciona | "no carga", "da error", "no puedo entrar" | "não carrega", "dá erro" |
| `solicitud_reembolso` | Pedir devolución de dinero o cargo | "quiero mi dinero de vuelta", "me cobraron mal" | "quero meu dinheiro", "cobraram errado" |
| `cambio_datos` | Actualizar información personal o de cuenta | "cambiar mi teléfono", "actualizar correo" | "mudar telefone", "atualizar email" |
| `consulta_estado` | Preguntar por estado de pedido, reclamo, ticket | "dónde está mi pedido", "mi ticket" | "cadê meu pedido", "meu chamado" |
| `queja_servicio` | Expresar insatisfacción con el servicio en general | "el servicio es pésimo", "quiero hablar con un humano" | "péssimo serviço", "quero falar com humano" |
| `solicitud_info` | Pedir información general sobre productos/servicios | "cómo funciona", "qué incluye el plan" | "como funciona", "o que inclui" |
| `cancelacion` | Cancelar servicio, suscripción o pedido | "quiero cancelar", "dar de baja" | "quero cancelar", "cancelar assinatura" |
| `otra` | No encaja en ninguna categoría anterior | — | — |

## Criterio de Resolución

### `resolved: bool`
Marcar `resolved = False` cuando:
- En los **3 turnos del bot posteriores** al turno del usuario NO hay:
  - Confirmación explícita: "listo", "resuelto", "ya está procesado", "pronto", "feito"
  - Número de ticket/caso asignado
  - Instrucción de seguimiento clara con pasos
- El usuario repite la misma intención >1 vez en la sesión (el bot no la resolvió la primera vez)
- La sesión termina con `abandonment_risk = True`

### `resolved = True` cuando:
- El bot confirma explícitamente la acción realizada
- El usuario responde con sentiment `satisfecho` después de la respuesta del bot
- Se asigna número de caso con ETA de resolución

## Intent Confidence (float 0.0 - 1.0)
- Qué tan seguro está el modelo de la clasificación
- < 0.6 → marcar como `otra` y loggear para revisión humana
- > 0.85 → alta confianza

## Output por Turno
```json
{
  "intent_label": "consulta_saldo|reporte_problema|...|otra|null",
  "intent_confidence": 0.87,
  "resolved": false
}
```

## Output Adicional
Generar JSON: `data/processed/unresolved_intents_ranking.json`
```json
{
  "ranking": [
    {
      "intent_label": "reporte_problema",
      "total_occurrences": 4521,
      "unresolved_count": 2134,
      "unresolved_pct": 47.2,
      "avg_frustration_when_unresolved": 0.74
    }
  ]
}
```
Ordenado por `unresolved_count` DESC. Top 10.

## Casos Especiales
- Un turno puede tener múltiples intenciones → clasificar la **primaria** (la más urgente)
- Intenciones implícitas: "ya chole" después de 5 turnos sin respuesta = `queja_servicio`
- "quiero hablar con un humano" siempre = `queja_servicio` con `resolved = False` a menos que se transfiera

## Librerías Autorizadas
```
pandas>=2.0
structlog
json (stdlib)
```
