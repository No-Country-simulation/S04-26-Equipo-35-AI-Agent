"""
ConversaAI Crew — Orquestación principal.
Ejecutar: python src/crew.py --corpus data/raw/corpus_mes.csv
"""
import argparse
import os
from pathlib import Path

import structlog
from crewai import Agent, Crew, Process, Task
from pydantic import BaseModel, Field
from typing import List
from dotenv import load_dotenv
import pandas as pd
import time
import math

from src.llm_factory import get_llm
from src.db.repository import DBRepository

# ── SCHEMAS PYDANTIC ──────────────────────────────────────────────────────────

class MensajeEnriquecido(BaseModel):
    session_id: str
    turn_id: int
    fecha: str
    region: str
    texto_espanol: str = ""
    texto_portugues: str = ""
    text_clean: str
    intencion_original: str
    nivel_frustracion: int
    es_churn_risk: bool
    sentiment_label: str = Field(description="frustrado, neutro, satisfecho")
    sentiment_score: float
    escalation: bool
    abandonment_risk: bool
    intent_label: str
    intent_confidence: float
    resolved: bool

class PipelineOutput(BaseModel):
    mensajes: List[MensajeEnriquecido]

# Cargar .env explícitamente desde la raíz del proyecto Agentes
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env", override=True)
log = structlog.get_logger()

# ── LLMs ─────────────────────────────────────────────────────────────────────
# Proveedor configurable via LLM_PROVIDER en .env:
#   groq      → desarrollo/testing (default)
#   anthropic → producción

llm_fast = get_llm(role="fast")
llm_smart = get_llm(role="smart")

# ── AGENTES ───────────────────────────────────────────────────────────────────

etl_agent = Agent(
    role="Senior Data Engineer — NLP Pipeline Specialist",
    goal=(
        "Cargar el corpus de soporte desde {corpus_path} y producir un JSONL limpio, "
        "normalizado y validado con schema estricto. Cada campo debe cumplir el contrato "
        "de datos exacto para que los agentes downstream (Sentiment, Intent) operen "
        "sin errores. Cero tolerancia a datos corruptos: si una fila no cumple "
        "el schema, se descarta y se loguea — nunca se propaga basura al pipeline."
    ),
    backstory=(
        "Ingeniero de datos con 8 años procesando texto multilingüe en producción para LATAM. "
        "Ha construido pipelines ETL que procesan 2M+ mensajes/mes de soporte en ES y PT-BR. "
        "Conoce cada tipo de ruido en conversaciones reales: timestamps embebidos [12:34], "
        "IDs de sesión como #SES-12345, tags HTML residuales, emojis que alteran el meaning "
        "(frustración vs satisfacción), URLs de tracking, y abreviaciones regionales. "
        "Filosofía: 'Si el dato no está limpio, el modelo miente'. "
        "Aplica Pydantic v2 para validación estricta — ningún registro pasa sin cumplir schema."
    ),
    llm=llm_fast,
    verbose=True,
)

sentiment_agent = Agent(
    role="Behavioral Psychologist — Customer Emotion Analyst",
    goal=(
        "Analizar cada mensaje del usuario con la precisión de un psicólogo organizacional. "
        "No solo clasificar frustrado/neutro/satisfecho, sino detectar los MOMENTOS EXACTOS "
        "de quiebre emocional: cuándo el usuario pasa de paciente a frustrado, cuándo la "
        "frustración escala a ira, y cuándo el silencio indica abandono inminente. "
        "El score (0.0-1.0) debe reflejar matices: 'no funciona' (0.4) no es "
        "lo mismo que 'ESTO ES UN ROBO, LLEVO 5 DÍAS' (0.95). "
        "Cada flag de escalation y abandonment_risk debe ser defendible con evidencia textual."
    ),
    backstory=(
        "Psicóloga organizacional con especialización en análisis de conversaciones de soporte "
        "en LATAM. Ha estudiado 500,000+ interacciones y desarrollado un framework propio de "
        "'señales de quiebre emocional' que VADER/TextBlob no pueden detectar porque no entienden "
        "el español coloquial ni el portugués brasileño. "
        "Sabe que 'no me entiende' en soporte es frustración acumulada (no confusión), que "
        "'ya chole' (MX) es 'estoy harto', que 'que absurdo' (PT-BR) indica indignación activa. "
        "Detecta patrones sutiles: el usuario que pasa de preguntar educadamente a mayúsculas "
        "sostenidas, el que repite la misma frase 3 veces (señal de bot loop), el que dice "
        "'ok' secamente después de 5 turnos frustrados (falsa resolución). "
        "Regla de oro: 'El sentimiento no está en las palabras individuales sino en el arco "
        "narrativo de la conversación'."
    ),
    llm=llm_smart,
    verbose=True,
)

intent_agent = Agent(
    role="Conversational UX Researcher — Intent Gap Detective",
    goal=(
        "Detectar la intención REAL del usuario (no la superficial) y determinar con rigor "
        "si el bot la resolvió efectivamente. Un 'entiendo, voy a revisar' del bot NO es "
        "resolución — es evasión. Un número de ticket sin ETA NO es resolución para un "
        "reembolso. Clasificar cada turno en las 9 categorías del catálogo y producir el "
        "ranking definitivo de intenciones no resueltas que el equipo de producto necesita. "
        "Cada resolved=False debe contar una historia: qué pidió el usuario, qué respondió "
        "el bot, y por qué no fue suficiente."
    ),
    backstory=(
        "UX Researcher especializado en diseño conversacional con 6 años detectando 'intent gaps': "
        "los momentos donde el bot responde algo técnicamente correcto pero emocionalmente "
        "insuficiente. Ha mapeado los 50+ patrones de fallo más comunes en bots LATAM. "
        "Sabe que 'quiero hablar con un humano' SIEMPRE es queja_servicio no resuelta. "
        "Sabe que cuando un usuario dice 'ok' después de 3 intentos fallidos, resolved debe "
        "ser False porque resignación no es resolución. "
        "Entiende intenciones implícitas: 'llevo 3 días esperando' = consulta_estado + "
        "queja_servicio. En esos casos clasifica la intención primaria (la más urgente). "
        "Framework: mide resolución por 'cierre emocional' (el usuario terminó satisfecho "
        "o neutro) no solo por 'cierre operativo' (el bot dijo 'listo')."
    ),
    llm=llm_smart,
    verbose=True,
)

analyst_agent = Agent(
    role="Head of Product Analytics — CX Strategy Lead",
    goal=(
        "Transformar datos de sentimiento e intención en una narrativa estratégica que el "
        "VP de Producto pueda usar para tomar decisiones en la reunión de sprint. No solo "
        "reportar que 'reporte_problema tiene 47%% sin resolver' sino explicar POR QUÉ: "
        "el bot pide reiniciar la app en el 80%% de los casos, lo cual es insuficiente para "
        "problemas de backend. Identificar los 3 quick wins P1, las 5 mejoras P2, y documentar "
        "el backlog P3. Cada recomendación debe tener: 1) acción concreta ejecutable en 1-2 "
        "semanas, 2) métrica de éxito medible con este mismo pipeline el mes siguiente, "
        "3) impacto estimado en frustración y resolución."
    ),
    backstory=(
        "Head of Analytics con 10 años convirtiendo datos de soporte en estrategia de producto. "
        "Ha presentado insights a C-level en 3 empresas de LATAM y sabe que un buen reporte no "
        "lista números — cuenta la historia del cliente. "
        "Piensa en 'customer journeys rotos': no hay intenciones aisladas, hay secuencias de "
        "frustración que predicen churn. Un usuario que reporta un problema, no recibe solución, "
        "repite 2 veces, y abandona no es un dato — es un cliente perdido y un flujo roto. "
        "Sus recomendaciones siguen el framework 'Impacto × Esfuerzo': prioriza cambios que "
        "afectan a más usuarios con el menor esfuerzo de desarrollo. Nunca recomienda 'mejorar "
        "el bot en general' — siempre dice 'en el flujo de reporte_problema, cuando el usuario "
        "ya reinició, ofrecer escalación automática a L2 en lugar de repetir troubleshooting'. "
        "Regla: 'Si una recomendación no tiene métrica de éxito medible, no es una recomendación, "
        "es un deseo'."
    ),
    llm=llm_smart,
    verbose=True,
)

# ── TAREAS ────────────────────────────────────────────────────────────────────

task_etl = Task(
    description=(
        "Lee el corpus desde {corpus_path}. "
        "Valida columnas reales: session_id, usuario, fecha, region, intencion, nivel_frustracion, texto_espanol, texto_portugues, es_churn_risk. "
        "Deriva idioma desde region (LATAM/EUROPE=es, BRAZIL=pt). "
        "Limpia: selecciona texto según región, quita HTML, URLs → [URL], emojis no informativos. "
        "Emojis de frustración (😤😡) → [EMOJI_FRUSTRADO]. "
        "Normaliza: lowercase, espacios múltiples, caracteres repetidos. "
        "Segmenta en turnos con turn_id incremental por sesión (ordenado por fecha). "
        "Guarda en data/processed/processed_corpus.jsonl"
    ),
    expected_output=(
        "Archivo JSONL en data/processed/processed_corpus.jsonl con schema: "
        "{session_id, turn_id, usuario, fecha, region, lang, text_clean, texto_espanol, texto_portugues, intencion_original, nivel_frustracion, es_churn_risk}. "
        "Reporte de estadísticas: total msgs, total sesiones, distribución regional, "
        "avg turnos por sesión, msgs descartados."
    ),
    agent=etl_agent,
)

task_sentiment = Task(
    description=(
        "Lee data/processed/processed_corpus.jsonl. "
        "Para cada turno (todos son de usuario): "
        "clasifica sentiment (frustrado/neutro/satisfecho) con score 0-1 usando nivel_frustracion como input adicional. "
        "Marca escalation=True si el score de frustración sube >0.3 o si nivel_frustracion pasa a 2. "
        "Marca abandonment_risk=True si último turno tiene frustrado con score >0.7 "
        "o si es_churn_risk=True. "
        "Guarda corpus enriquecido y top_frustrated_sessions.csv"
    ),
    expected_output=(
        "JSONL enriquecido con campos: sentiment_label, sentiment_score, escalation, abandonment_risk. "
        "CSV en data/processed/top_frustrated_sessions.csv: "
        "top 50 sesiones por avg_frustration_score DESC. "
        "Columnas: session_id, avg_frustration_score, max_frustration_score, escalation_count, region."
    ),
    agent=sentiment_agent,
    context=[task_etl],
)

task_intent = Task(
    description=(
        "Lee data/processed/processed_corpus.jsonl enriquecido. "
        "Para cada turno (todos de usuario): "
        "clasifica intent con estas categorías (incluyendo logistica_envio, problema_pago). "
        "Usa intencion_original del CSV como contexto para reclasificar. "
        "confidence < 0.6 → clasificar como 'otra'. "
        "Marca resolved=False si la sesión llega a nivel_frustracion=2, si es_churn_risk=True, "
        "o si termina con frustración alta. "
        "Genera ranking de intenciones no resueltas."
    ),
    expected_output=(
        "Objeto JSON estricto con la lista de mensajes enriquecidos. "
        "Cada mensaje debe incluir sus atributos originales más los calculados: "
        "intent_label, intent_confidence, y resolved."
    ),
    output_pydantic=PipelineOutput,
    agent=intent_agent,
    context=[task_etl],
)

task_analyst = Task(
    description=(
        "Combina los outputs de sentiment e intent del corpus enriquecido. "
        "Calcula métricas globales: tasa de escalada, abandono, resolution rate, churn rate, "
        "distribución de sentimiento y regiones (LATAM/BRAZIL/EUROPE). "
        "Identifica top 5 flujos con mayor frustración. "
        "Analiza correlación entre intent no resuelto y frustración. "
        "Detecta patrones de abandono por región. "
        "Genera recomendaciones priorizadas P1/P2/P3 — concretas, con métrica de éxito. "
        "Formato del reporte: según estructura definida en skills/analyst_agent.md"
    ),
    expected_output=(
        "Reporte Markdown en reports/insights_report.md con: "
        "métricas globales, top 5 flujos frustrantes, top 10 intents no resueltos, "
        "patrones de abandono, diferencias por región, recomendaciones P1/P2/P3. "
        "JSON en data/processed/metrics_summary.json para el dashboard."
    ),
    agent=analyst_agent,
    context=[task_sentiment, task_intent],
)

# ── CREWS ──────────────────────────────────────────────────────────────────────

ingestion_crew = Crew(
    agents=[etl_agent, sentiment_agent, intent_agent],
    tasks=[task_etl, task_sentiment, task_intent],
    process=Process.sequential,
    verbose=True,
)

analyst_crew = Crew(
    agents=[analyst_agent],
    tasks=[task_analyst],
    process=Process.sequential,
    verbose=True,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="ConversaAI Crew Ingestion")
    parser.add_argument(
        "--corpus",
        type=str,
        default=os.getenv("CORPUS_PATH", "data/raw/data_conversa_ai.csv"),
        help="Path al corpus CSV mensual",
    )
    parser.add_argument(
        "--use-db",
        action="store_true",
        default=False,
        help="Persistir datos en Supabase (SQL) y Qdrant (vectorial).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Tamaño de cada lote de filas a procesar.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Límite máximo de filas a procesar (0 = todas).",
    )
    args = parser.parse_args()

    corpus_path = Path(args.corpus)
    if not corpus_path.exists():
        log.error("corpus_not_found", path=str(corpus_path))
        raise FileNotFoundError(f"Corpus no encontrado: {corpus_path}")

    log.info("Cargando corpus completo...", corpus=str(corpus_path))
    df = pd.read_csv(corpus_path)
    
    if args.limit > 0:
        df = df.head(args.limit)
        
    total_rows = len(df)
    batch_size = args.batch_size
    total_batches = math.ceil(total_rows / batch_size)
    
    log.info(f"Total filas: {total_rows}. Procesando en {total_batches} lotes de {batch_size}.")
    
    repo = DBRepository() if args.use_db else None
    
    for i in range(total_batches):
        batch_df = df.iloc[i*batch_size : (i+1)*batch_size]
        temp_path = Path(f"data/raw/temp_batch_{i}.csv")
        batch_df.to_csv(temp_path, index=False)
        
        log.info(f"--- Iniciando Lote {i+1}/{total_batches} ({len(batch_df)} filas) ---")
        
        try:
            _ = ingestion_crew.kickoff(inputs={
                "corpus_path": str(temp_path),
            })
            
            if repo:
                output_data = task_intent.output.pydantic
                if output_data and hasattr(output_data, "mensajes"):
                    session_cache = {}
                    for msg in output_data.mensajes:
                        sess_id = msg.session_id
                        if sess_id not in session_cache:
                            session_cache[sess_id] = {
                                "id": sess_id,
                                "usuario": "Usuario_Test",
                                "region": msg.region,
                                "total_turns": 0,
                                "avg_frustration_score": 0.0,
                                "max_frustration_score": 0.0,
                                "has_escalation": False,
                                "has_abandonment": False,
                                "dominant_intent": msg.intent_label,
                                "resolution_rate": 1.0 if msg.resolved else 0.0,
                                "is_churn_risk": msg.es_churn_risk
                            }
                        
                        session_cache[sess_id]["total_turns"] += 1
                        session_cache[sess_id]["has_escalation"] |= msg.escalation
                        session_cache[sess_id]["has_abandonment"] |= msg.abandonment_risk
                        
                        frust_val = min(int(msg.nivel_frustracion), 2)
                        if frust_val > session_cache[sess_id]["max_frustration_score"]:
                            session_cache[sess_id]["max_frustration_score"] = float(frust_val)
                            
                    for sess_data in session_cache.values():
                        repo.save_session(sess_data)
                        
                    for msg in output_data.mensajes:
                        msg_dict = msg.dict()
                        msg_dict["nivel_frustracion"] = min(int(msg_dict["nivel_frustracion"]), 2)
                        repo.save_message(msg_dict)
                        
                    log.info(f"Lote {i+1} guardado exitosamente: {len(output_data.mensajes)} mensajes procesados.")
                else:
                    log.warning(f"Lote {i+1}: No se pudo obtener output Pydantic estructurado de la tarea de Intent.")
        except Exception as e:
            log.error(f"Error procesando lote {i+1}: {e}")
        finally:
            if temp_path.exists():
                temp_path.unlink()
                
        if i < total_batches - 1:
            log.info("Pausando 5 segundos para respetar los Rate Limits de la API...")
            time.sleep(5)

    log.info("Procesamiento por lotes finalizado completamente.")


if __name__ == "__main__":
    main()

