# Engram — Setup y Uso en ConversaAI

## Qué es Engram aquí
Memoria persistente entre sesiones de Antigravity.
Sin Engram, cada sesión de coding empieza desde cero:
el agente no sabe qué construyó ayer, por qué eligió ese approach
ni qué errores ya se resolvieron.

## Instalación
```bash
pip install engram-memory   # o según repo oficial
# Alternativa si no está en PyPI:
# git clone https://github.com/eirikur/engram
# cd engram && pip install -e .
```

## Inicialización del Proyecto
```bash
cd conversa_crew/
engram init --project conversa_crew
```
Esto crea `.engram/` en la raíz del proyecto (agregar a .gitignore).

Agregar a .gitignore:
```
.engram/
```

## Cuándo Registrar en Engram

### Al completar un módulo o función importante
```bash
engram add \
  --what "Implementada función run_etl_pipeline() con detección de idioma por sesión" \
  --why "langdetect falla en mensajes cortos (<5 palabras), por eso detectamos por sesión no por turno" \
  --where "src/agents/etl_agent.py::run_etl_pipeline" \
  --learned "El threshold de 70% para asignar idioma de sesión funciona bien con sesiones >10 msgs; sesiones cortas quedan como 'es' por default"
```

### Al resolver un bug no obvio
```bash
engram add \
  --what "Fix: el Intent Agent marcaba resolved=True en turnos de bot" \
  --why "El filtro speaker==user no se aplicaba antes del loop de resolución" \
  --where "src/agents/intent_agent.py::detect_resolved" \
  --learned "Siempre filtrar por speaker ANTES de cualquier lógica de sesión"
```

### Al tomar una decisión de arquitectura
```bash
engram add \
  --what "Decidido procesar Sentiment e Intent secuencial, no paralelo" \
  --why "El merge de dos JSONL en paralelo producía duplicados de turn_id en el enriched corpus" \
  --where "src/crew.py" \
  --learned "Para paralelizar correctamente necesitaría escribir campos separados y hacer join al final por (session_id, turn_id)"
```

## Cuándo Consultar Engram

### Al iniciar una sesión de Antigravity
```bash
# Ver todo el historial del proyecto
engram list --project conversa_crew

# Buscar contexto del módulo que vas a modificar
engram search "etl_agent"
engram search "intent resolved"
engram search "JSONL merge"
```

### Antes de modificar un archivo existente
```bash
engram search "<nombre del archivo sin extensión>"
# Ejemplo:
engram search "sentiment_agent"
```

## Campos de Cada Registro Engram

| Campo | Contenido | Ejemplo |
|-------|-----------|---------|
| `--what` | Qué se implementó o aprendió | "Implementado batch processing de 50 msgs" |
| `--why` | Por qué se hizo así (la decisión) | "La API de Groq tiene rate limit de 6000 tokens/min" |
| `--where` | Archivo y función exactos | "src/agents/sentiment_agent.py::classify_batch" |
| `--learned` | Qué recordar para la próxima sesión | "Groq rechaza batches >60 msgs en qwen-qwq-32b" |

## Búsquedas Útiles para Este Proyecto
```bash
engram search "schema"          # decisiones de schema de datos
engram search "groq"            # límites y configs del LLM
engram search "pydantic"        # validaciones implementadas
engram search "bug"             # bugs resueltos
engram search "resolved"        # lógica de resolución de intenciones
engram search "escalation"      # lógica de detección de escalada
engram search "dashboard"       # estado del Streamlit
```

## Estructura de .engram/ (referencia)
```
.engram/
├── conversa_crew.db    ← SQLite con FTS5, búsqueda BM25
└── config.json         ← configuración del proyecto
```

## Regla de Equipo
Cada miembro registra en Engram al final de su sesión.
El próximo en abrir Antigravity busca en Engram antes de escribir código.
Esto reemplaza los comentarios "// TODO: recordar que..." en el código.
