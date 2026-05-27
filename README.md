# ConversaAI — Dashboard + Pipeline de análisis

Monorepo: **pipeline Python** (sentiment/intent/analyst) + **dashboard Next.js** + copiloto RAG agéntico.

Diseñado para equipos de producto: todo el lenguaje está adaptado a terminología PM (solicitudes, fricción, tasa de resolución) en lugar de términos técnicos (intents, IRR, frustration score).

## Requisitos

- Node.js 20+
- Python 3.12+ y [uv](https://docs.astral.sh/uv/)
- Docker (Qdrant local, opcional pero recomendado con `--use-db`)

## Inicio rápido

```bash
# 1. Frontend
npm install
cp .env.example .env.local   # Supabase, Groq, Cohere, Qdrant

# 2. Pipeline
cd Agentes && uv sync && cp .env.example .env
cd ..

# 3. Qdrant
docker compose up -d

# 4. Demo (corpus pequeño)
chmod +x scripts/demo.sh
./scripts/demo.sh

# 5. Dashboard
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Ingesta corpus real (~20k mensajes)

```bash
cd Agentes
# Agentes/.env → LLM_SMART_PROVIDER=groq (free tier Gemini/Groq TPD limita volumen)
uv run python -m src.cli ingest \
  --corpus data/raw/data_conversa_ai.csv \
  --use-db \
  --smart-recommendations
```

Si hay **429 / rate limit**, reanuda al día siguiente con el mismo comando (checkpoint por etapa).

## Estructura

| Ruta | Rol |
|------|-----|
| `Agentes/src/` | Pipeline ETL → sentiment → intent → analyst |
| `Agentes/src/cli.py` | CLI: `ingest`, `evaluate`, `reset-checkpoint` |
| `src/app/` | Next.js App Router + API (`/api/chat`, `/api/pipeline/*`) |
| `src/components/` | Dashboard producto + `CopilotChat` |
| `scripts/demo.sh` | Demo end-to-end con mini corpus |

## Copiloto Analítico

Asistente conversacional con RAG y herramientas específicas para análisis de producto:

- **KPIs globales**: churn, tasa de resolución, abandono, fricción promedio
- **Matriz de solicitudes**: qué tipos de consultas tienen peor experiencia y mayor impacto
- **Sesiones con fricción**: casos concretos de clientes frustrados o en riesgo de abandono
- **Búsqueda semántica RAG** (Qdrant): ejemplos reales de conversaciones, frases de clientes, evidencia cualitativa
- **Historias de usuario**: backlog priorizado con métricas de impacto

### Formato de respuesta

Todas las respuestas estructuradas como:

1. **Diagnóstico** — qué está pasando
2. **Evidencia** — datos o citas de clientes
3. **Próximo paso recomendado** — acción concreta para el equipo

Citas con `session_id` copiables en el panel para verificación.

### Configuración

Variables en `.env.local`:
```
GROQ_API_KEY=           # Para el copiloto (modelo Qwen 3 32B)
COHERE_API_KEY=         # Para embeddings del RAG
QDRANT_URL=             # URL de Qdrant (local o cloud)
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Monitoreo MLOps y Gestión del Ciclo de Vida (Fase 2 y 4)

El dashboard cuenta con herramientas avanzadas para la gestión del pipeline de datos y el seguimiento del plan de acción para el equipo de producto.

### 1. Control del Pipeline de Ingesta y MLOps (`/corpus/cargar`)
Desde la pestaña **"Pipeline datos"** en la barra lateral del dashboard, los analistas y PMs pueden controlar el ciclo de vida completo de los datos:
* **Ejecución Modular por Etapas**: Se puede ejecutar todo el pipeline o correr etapas específicas de forma independiente:
  1. **ETL (Paso 1)**: Carga y limpia el corpus, detectando idioma y normalizando los campos en español y portugués a la base de datos Supabase.
  2. **Sentimiento (Paso 2)**: Corre la clasificación emocional de cada mensaje mediante modelos LLM.
  3. **Intención (Paso 3)**: Detecta las intenciones del usuario y define el estado de resolución de la conversación.
  4. **Vectorizar a Qdrant (Paso 4)**: Genera embeddings de 1024 dimensiones a través de Cohere API y los indexa en Qdrant para el copiloto.
  5. **Generar Reporte y Métricas (Paso 5)**: Ejecuta el análisis final calculando métricas de negocio, KPI y generando historias de usuario ordenadas por impacto.
* **Panel de Estado en Tiempo Real (Live Status Panel)**: Visualiza en tiempo real el progreso de cada etapa, el estado del worker de fondo, y estadísticas agregadas de mensajes procesados, clasificados y vectorizados en la BD y en Qdrant.
* **Cola de Tareas (Task Queue)**: Muestra la posición en cola de los trabajos y actualiza dinámicamente según la disponibilidad del backend.
* **Historial de Ingestas**: Guarda una bitácora de los corpus ingestados históricamente con su estado final (Completado/Fallido), la cantidad total de mensajes, fecha y hora de inicio/fin, y duración.

### 2. Sincronización Kanban y Gestión de Acciones (`/acciones`)
El **Action Hub (Tablero Kanban)** está sincronizado de forma interactiva con los módulos de priorización:
* **Cruce e Identificación en Tiempo Real**: En las pestañas de **Solicitudes** (`/intenciones`) y **Frustración** (`/frustracion`), los elementos que ya tienen planes de acción asociados muestran insignias de estado dinámicas ("Planificado", "En análisis", "En desarrollo", "Resuelto") y un link de navegación rápida al Kanban.
* **Prevención de Duplicados**: Al hacer clic en "Crear Acción" dentro del detalle lateral, el botón se desactiva inmediatamente y transita a un estado enlazado de forma de badge y enlace persistente.
* **Normalización de Llaves (`normalizeKey`)**: Se utiliza lógica de normalización a nivel de caracteres (remoción de acentos, minúsculas, etc.) para vincular de forma robusta las intenciones extraídas por el agente (como `"Facturacion Fallida"`) con las del dashboard.
* **Filtrado Automático de Resueltos**: Cuando una tarjeta Kanban pasa al estado "Resuelto", la solicitud o fricción asociada se oculta automáticamente de las tablas de priorización activa y los KPIs de las vistas principales.
* **Historial de Archivación**: En la columna **Resuelto**, se proporciona un botón de **Archivar** que añade un prefijo `[ARCHIVED]` al campo de notas en la base de datos (preservando los constraints de PostgreSQL).
* **Auditoría Histórica**: Un panel colapsable al pie de las pantallas permite inspeccionar, desarchivar (restaurar al tablero) o eliminar de manera permanente las acciones del backlog histórico que ya fueron resueltas por el equipo.

## Lenguaje Product Manager

Todo el dashboard usa terminología de producto en lugar de términos técnicos:

| Técnico (antes) | PM (ahora) |
|-----------------|------------|
| P1 / P2 / P3 | Crítico / Alta prioridad / Oportunidad |
| Intent | Solicitud del cliente |
| IRR | Tasa de resolución |
| Frustration score | Malestar |
| Loop del bot | Clientes que repiten sin resolver |
| Churn risk | Riesgo de abandono |
| Sentiment agreement | El bot entiende el estado emocional |
| Intent accuracy | El bot clasifica bien las solicitudes |

## Tests

```bash
cd Agentes && uv run pytest tests/ -v
npm run build
```

Para verificar el copiloto:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"id":"test","messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"cuanto churn tenemos"}]}]}'
```

## Arquitectura Enterprise (Escalabilidad)

Esta implementación es un **MVP funcional**. Para producción real con volúmenes altos (10k+ mensajes/día), considerar:

### Opciones de escalado

| Estrategia | Cuándo usar | Costo aprox | Cambios necesarios |
|------------|-------------|-------------|-------------------|
| **Múltiples workers** | >5k msgs/día | +$50/mes infra | Agregar Redis/RabbitMQ + workers paralelos |
| **Modelo propio (cloud)** | >20k msgs/día | $200-500/mes | Fine-tuning en AWS/GCP + endpoint propio |
| **Modelo local (GPU)** | >50k msgs/día | $2k hardware | Servidor con RTX 4090/A100 + Ollama/vLLM |
| **Batch processing** | Cualquier volumen | - | Procesar de noche en lugar de real-time |

### Arquitectura recomendada para escalar

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Upload    │────▶│  Kafka/SQS   │────▶│  Workers    │
│   CSV/API   │     │   (cola)     │     │  (paralelo) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                  │
                    ┌─────────────────────────────┘
                    ▼
┌────────────────────────────────────────────────────────┐
│  Supabase (datos)  │  Qdrant (vectors)  │  Dashboard   │
└────────────────────────────────────────────────────────┘
```

### Verificar si tu PC puede correr modelos locales

```bash
python3 scripts/check_hardware.py
```

Esto analiza tu GPU/VRAM/RAM y sugiere modelos que puedas ejecutar localmente (Llama, Mistral, etc).

### Costos estimados

- **MVP actual (Groq free)**: $0 (limitado a ~10k msgs/día por rate limit)
- **Groq/Together AI (paygo)**: ~$0.001 por mensaje → $300/mes para 10k msgs/día
- **Modelo propio fine-tuned**: $500 setup + $150/mes serving
- **Local GPU (RTX 4090)**: $2000 hardware → $0/mes después

### Cuándo mantener esta arquitectura MVP

✅ Volumen bajo (<5k msgs/día)  
✅ Presupuesto limitado  
✅ Validando producto (PMF)  
✅ Prototipo para stakeholders  

### Cuándo migrar a Enterprise

⚠️ Rate limit frecuente (429)  
⚠️ Pipeline tarda >2 horas  
⚠️ Necesitas <1s por mensaje  
⚠️ Costo de APIs >$500/mes  

---

## 🏗️ Arquitectura de Ingesta Asíncrona (Redis Queue & Workers)

Para procesar grandes volúmenes de datos (~20k mensajes o más) de forma asíncrona y sin bloquear la experiencia del usuario en el Dashboard, la plataforma implementa un flujo basado en colas de mensajería:

```
[Dashboard UI] 
      │ (Subir CSV / Iniciar Etapa)
      ▼
[API Next.js] ────▶ [ Redis: jobs:pending ] (Cola FIFO)
                           │
       ┌───────────────────┼───────────────────┐
       ▼ (brpop)           ▼ (brpop)           ▼ (brpop)
  [Worker 1]          [Worker 2]          [Worker 3]  (Escalado en paralelo)
  (python)            (python)            (python)
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
             [ Supabase DB / Qdrant Vector DB ]
```

1. **Encolado de Tareas (Next.js):** El frontend realiza una llamada a la API Next.js (`/api/pipeline/enqueue`), la cual genera un ID de trabajo (`job_id`) y encola los metadatos en la lista Redis `jobs:pending`.
2. **Consumo Atómico (brpop):** Uno o más scripts [worker.py](file:///home/borges/Documentos/GitHub/S04-26-Equipo-35-AI-Agent/Agentes/src/worker.py) de Python se ejecutan en segundo plano. Cada worker utiliza la operación atómica bloqueante `brpop` de Redis para extraer trabajos de la cola. Esto asegura paralelismo real y previene que el mismo trabajo sea procesado por más de un worker.
3. **Control de Progreso en Tiempo Real:** Durante el procesamiento (ETL, Sentimiento, Intención, Generación de Embeddings, Reportes), el worker actualiza el estado y progreso en Redis utilizando hashes (`job:<job_id>`) y publica eventos de progreso a través de Redis Pub/Sub (`jobs:progress:<job_id>`). El Dashboard escucha estos eventos mediante polling para mostrar barras de progreso y logs en tiempo real.
4. **Resiliencia ante Fallos:** Si un paso falla, el job se mueve automáticamente a `jobs:failed` o se reintenta según el contador de reintentos (`MAX_RETRIES = 3`).

---

## 🔗 Integraciones MCP y Lazo Cerrado (Closed-Loop Workflow)

Para conectar ConversaAI con las herramientas del equipo de IT e ingeniería (Jira, Slack, Trello), implementamos una infraestructura híbrida:

1. **Model Context Protocol (MCP):**
   - El backend utiliza `McpClientManager` ([mcp-client.ts](file:///home/borges/Documentos/GitHub/S04-26-Equipo-35-AI-Agent/src/lib/mcp-client.ts)) para gestionar conexiones SSE dinámicas con múltiples servidores de herramientas independientes.
   - Las herramientas de creación en Jira, Slack y Trello se exponen al LLM de forma dinámica y también se exponen a través de endpoints REST (`/api/integrations/[service]`) consumidos por botones gráficos del frontend.
2. **Vínculo del Ticket de Jira:** Al exportar un ítem de acción del dashboard a Jira, se genera el ticket (ej: `CONV-270`) y su ID se guarda de forma permanente en la columna `notes` de Supabase con el formato `[JIRA: CONV-270]`.
3. **Webhook de Retorno (Lazo Cerrado):**
   - Cuando un desarrollador completa y cierra la issue en Jira (estado `"done"` o `"resolved"`), Jira envía una petición POST HTTP al endpoint de webhook de la plataforma: `/api/webhooks/jira`.
   - El webhook busca en Supabase las tarjetas asociadas por el ticket key en `notes` y actualiza automáticamente su estado a `resolved`.
   - **Sincronización Visual:** Para reflejar esto sin forzar recargas de página, el frontend realiza un sondeo inteligente (polling) de 4 segundos que actualiza el tablero Kanban y los widgets en tiempo real.

---

## ☁️ Guía de Despliegue en la Nube (Producción)

Es una excelente práctica documentar cómo llevar este monorepo híbrido (Next.js + Python + Redis + Vector DB) a un entorno de producción en la nube. Aquí se detalla la configuración recomendada:

```
                      ┌───────────────┐
                      │   Cliente     │
                      └───────┬───────┘
                              │
                              ▼ (HTTPS)
                      ┌───────────────┐
                      │    Vercel     │ (Frontend Next.js)
                      │ (API Router)  │
                      └───────┬───────┘
         ┌────────────────────┼────────────────────┐
         ▼ (PostgreSQL)       ▼ (Redis Protocol)   ▼ (HTTPS / SSE)
┌────────────────┐    ┌───────────────┐    ┌────────────────┐
│ Supabase Cloud │    │ Upstash Redis │    │  Qdrant Cloud  │ (Vector DB)
└────────────────┘    └───────┬───────┘    └────────────────┘
                              ▲ (Redis Protocol)
                      ┌───────┴───────┐
                      │    Railway    │ (Python Worker Continuo)
                      │ (worker.py)   │
                      └───────────────┘
```

### 1. Base de Datos (Supabase Cloud)
1. Crea un proyecto en [Supabase Cloud](https://supabase.com/).
2. Ejecuta el script SQL de inicialización ([setup_tables.sql](file:///home/borges/Documentos/GitHub/S04-26-Equipo-35-AI-Agent/Agentes/scripts/setup_tables.sql)) en el editor de consultas SQL de Supabase para generar las tablas `messages`, `sessions`, `action_items` y `processed_jobs`.
3. Copia las credenciales (URL y Service Role Key) para las variables de entorno.

### 2. Base de Datos Vectorial (Qdrant Cloud)
1. Crea un cluster gratuito en [Qdrant Cloud](https://qdrant.tech/).
2. Obtén la URL del cluster y la API Key correspondiente.

### 3. Cola de Mensajería y Caché (Upstash Redis)
1. Crea una base de datos Redis serverless gratuita en [Upstash](https://upstash.com/) o [Redis Cloud](https://redis.com/).
2. Obtén la URL de conexión en formato `redis://:password@host:port/0`.

### 4. Despliegue de los Python Workers (Railway o Render)
El worker continuo debe correr en un servicio de tipo "Background Worker" o contenedor de Docker permanente:
1. Conecta tu repositorio de GitHub a [Railway](https://railway.app/) o [Render](https://render.com/).
2. Crea un **Servicio de Fondo (Worker)** para la carpeta `Agentes/`.
3. Configura el comando de inicio (Start Command):
   ```bash
   uv run python src/worker.py
   ```
4. Configura las siguientes Variables de Entorno en el servicio del worker:
   - `REDIS_URL`: URL de Upstash Redis.
   - `SUPABASE_URL`: URL de Supabase Cloud.
   - `SUPABASE_KEY`: Service Role API Key de Supabase.
   - `COHERE_API_KEY`: API Key para embeddings vectoriales.
   - `QDRANT_URL`: URL de Qdrant Cloud.
   - `QDRANT_API_KEY`: Token de autenticación de Qdrant Cloud.
   - `GROQ_API_KEY` (o `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`): Credenciales del LLM para análisis cognitivo de sentimiento e intención.

### 5. Despliegue del Frontend y API Routes (Vercel)
1. Crea un proyecto en [Vercel](https://vercel.com/) apuntando al directorio raíz del monorepo.
2. Configura las Variables de Entorno de producción:
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MCP_SERVERS`: URLs de producción de tus servidores MCP.
   - `REDIS_URL`: La misma URL de Upstash Redis (permite encolar trabajos).
3. Vercel compilará la aplicación Next.js y desplegará los endpoints REST de forma serverless.

---

Documentación detallada del pipeline: [`Agentes/README.md`](Agentes/README.md).

Plan de implementación: [`docs/plan-implementacion-2-semanas.md`](docs/plan-implementacion-2-semanas.md).

