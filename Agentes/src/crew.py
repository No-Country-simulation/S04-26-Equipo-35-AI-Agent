"""
ConversaAI Crew — Orquestación principal.
Ejecutar: python src/crew.py --corpus data/raw/corpus_mes.csv
"""
import argparse
from pathlib import Path

import structlog
from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv

from src.llm_factory import get_llm

load_dotenv()
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
        "Valida columnas: session_id, timestamp, speaker, text. "
        "Detecta idioma por sesión (es/pt). "
        "Limpia: timestamps inline, IDs, HTML, URLs → [URL], emojis no informativos. "
        "Emojis de frustración (😤😡) → [EMOJI_FRUSTRADO]. "
        "Normaliza: lowercase, espacios múltiples, caracteres repetidos. "
        "Mapea speaker='system'|'agent' → 'bot'. "
        "Segmenta en turnos con turn_id incremental por sesión. "
        "Guarda en data/processed/processed_corpus.jsonl"
    ),
    expected_output=(
        "Archivo JSONL en data/processed/processed_corpus.jsonl con schema: "
        "{session_id, turn_id, speaker: bot|user, text_clean, lang: es|pt}. "
        "Reporte de estadísticas: total msgs, total sesiones, distribución ES/PT, "
        "avg turnos por sesión, msgs descartados."
    ),
    agent=etl_agent,
)

task_sentiment = Task(
    description=(
        "Lee data/processed/processed_corpus.jsonl. "
        "Para cada turno con speaker=user: "
        "clasifica sentiment (frustrado/neutro/satisfecho) con score 0-1. "
        "Marca escalation=True si el score de frustración sube >0.3 en 2 turnos consecutivos "
        "del mismo usuario, o si usa lenguaje agresivo, o repite misma frase >2 veces. "
        "Marca abandonment_risk=True si último turno tiene frustrado con score >0.7 "
        "y no hay respuesta posterior del usuario. "
        "Para speaker=bot: campos sentiment en null. "
        "Guarda corpus enriquecido y top_frustrated_sessions.csv"
    ),
    expected_output=(
        "JSONL enriquecido con campos: sentiment_label, sentiment_score, escalation, abandonment_risk. "
        "CSV en data/processed/top_frustrated_sessions.csv: "
        "top 50 sesiones por avg_frustration_score DESC. "
        "Columnas: session_id, avg_frustration_score, max_frustration_score, escalation_count, lang."
    ),
    agent=sentiment_agent,
    context=[task_etl],
)

task_intent = Task(
    description=(
        "Lee data/processed/processed_corpus.jsonl. "
        "Para cada turno con speaker=user: "
        "clasifica intent con estas categorías: consulta_saldo, reporte_problema, "
        "solicitud_reembolso, cambio_datos, consulta_estado, queja_servicio, "
        "solicitud_info, cancelacion, otra. "
        "confidence < 0.6 → clasificar como 'otra'. "
        "Marca resolved=False si en los 3 turnos del bot posteriores no hay "
        "confirmación explícita de resolución, número de ticket, o instrucción clara. "
        "También resolved=False si el usuario repite la misma intención en la sesión. "
        "Para speaker=bot: campos intent en null. "
        "Genera ranking de intenciones no resueltas."
    ),
    expected_output=(
        "JSONL enriquecido con campos: intent_label, intent_confidence, resolved. "
        "JSON en data/processed/unresolved_intents_ranking.json: "
        "top 10 intents por unresolved_count con campos: "
        "intent_label, total_occurrences, unresolved_count, unresolved_pct, avg_frustration_when_unresolved."
    ),
    agent=intent_agent,
    context=[task_etl],
)

task_analyst = Task(
    description=(
        "Combina los outputs de sentiment e intent del corpus enriquecido. "
        "Calcula métricas globales: tasa de escalada, abandono, resolution rate, "
        "distribución de sentimiento, ES vs PT. "
        "Identifica top 5 flujos con mayor frustración (por intent + patrón de bot). "
        "Analiza correlación entre intent no resuelto y frustración. "
        "Detecta patrones de abandono: turno, intent, diferencias ES/PT. "
        "Genera recomendaciones priorizadas P1/P2/P3 — concretas, con métrica de éxito. "
        "Formato del reporte: según estructura definida en skills/analyst_agent.md"
    ),
    expected_output=(
        "Reporte Markdown en reports/insights_report.md con: "
        "métricas globales, top 5 flujos frustrantes, top 10 intents no resueltos, "
        "patrones de abandono, diferencias ES/PT, recomendaciones P1/P2/P3. "
        "JSON en data/processed/metrics_summary.json para el dashboard."
    ),
    agent=analyst_agent,
    context=[task_sentiment, task_intent],
)

# ── CREW ──────────────────────────────────────────────────────────────────────

crew = Crew(
    agents=[etl_agent, sentiment_agent, intent_agent, analyst_agent],
    tasks=[task_etl, task_sentiment, task_intent, task_analyst],
    process=Process.sequential,
    verbose=True,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="ConversaAI Crew")
    parser.add_argument(
        "--corpus",
        type=str,
        default="data/raw/corpus_mes.csv",
        help="Path al corpus CSV mensual",
    )
    parser.add_argument(
        "--smart-recommendations",
        action="store_true",
        default=False,
        help="Usar LLM para generar recomendaciones inteligentes (requiere API credits)",
    )
    args = parser.parse_args()

    corpus_path = Path(args.corpus)
    if not corpus_path.exists():
        log.error("corpus_not_found", path=str(corpus_path))
        raise FileNotFoundError(f"Corpus no encontrado: {corpus_path}")

    log.info(
        "crew_starting",
        corpus=str(corpus_path),
        smart_recommendations=args.smart_recommendations,
    )
    result = crew.kickoff(inputs={
        "corpus_path": str(corpus_path),
        "smart_recommendations": args.smart_recommendations,
    })
    log.info("crew_completed")
    log.info("crew_result", result=str(result))


if __name__ == "__main__":
    main()
