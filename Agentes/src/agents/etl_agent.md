# SKILL — ETL Agent

## Responsabilidad
Limpiar y normalizar el corpus mensual de conversaciones de soporte.
Input: CSV crudo. Output: JSONL limpio con schema estándar.

## Idiomas Objetivo
- Español LATAM (es): Argentina, Bolivia, Colombia, México, Perú
- Portugués Brasil (pt): variantes coloquiales de soporte

## Pipeline de Limpieza — Orden Obligatorio

1. **Cargar CSV** con pandas, validar columnas requeridas: `session_id, timestamp, speaker, text`
2. **Detectar idioma** por sesión (no por mensaje) usando `langdetect`. Si la sesión tiene >70% mensajes en un idioma, asignar ese idioma a toda la sesión.
3. **Eliminar ruido**:
   - Timestamps inline en el texto: `[12:34]`, `(15:22:01)`
   - IDs de sesión embebidos: `#SES-12345`, `TICKET-`
   - HTML tags: `<br>`, `&nbsp;`, etc.
   - URLs completas → reemplazar con `[URL]`
   - Emojis NO informativos: ❌ `😊`, `👍` → eliminar. Informativos: ❌ `😤`, `😡` → conservar como texto `[EMOJI_FRUSTRADO]`
   - Caracteres repetidos: `nooooo` → `no`, `ayudaaaa` → `ayuda`
4. **Normalizar texto**:
   - Lowercase
   - Eliminar espacios múltiples
   - Preservar signos de interrogación y exclamación (son señales de emoción)
5. **Segmentar en turnos**: cada fila = un turno. Asignar `turn_id` incremental por sesión.
6. **Validar speaker**: solo valores permitidos `bot` | `user`. Cualquier otro valor → loggear y descartar.

## Schema de Salida (JSONL)
```json
{
  "session_id": "string",
  "turn_id": 0,
  "speaker": "user|bot",
  "text_clean": "string",
  "lang": "es|pt"
}
```

## Estadísticas a Reportar
Al finalizar, el agente debe reportar:
- Total de mensajes procesados
- Total de sesiones únicas
- Distribución ES vs PT (%)
- Promedio de turnos por sesión
- Mensajes descartados y motivo

## Casos Especiales ES/PT
- Mezcla de idiomas dentro de una sesión → asignar idioma mayoritario
- "Code-switching" (alternancia es/pt en mismo mensaje) → mantener como está, asignar idioma de sesión
- Mensajes del bot en inglés en sesión en español → mantener, marcar `lang` de sesión

## Errores Conocidos del Corpus
- Algunas filas tienen `speaker` = `system` o `agent` → mapear a `bot`
- Timestamps como columna y también embebidos en `text` → eliminar solo los del texto
- Sessions con un solo mensaje → conservar, no descartar (son abandonos tempranos)

## Librerías Autorizadas
```
pandas>=2.0
langdetect>=1.0.9
re (stdlib)
json (stdlib)
pathlib (stdlib)
structlog
```

## Output
Guardar en `data/processed/processed_corpus.jsonl`
Un objeto JSON por línea.
