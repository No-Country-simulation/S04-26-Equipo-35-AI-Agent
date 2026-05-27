#!/usr/bin/env python3
"""
Worker Pipeline - Consume jobs desde Redis y procesa en background.

Este worker reemplaza el procesamiento síncrono del pipeline con un sistema
basado en colas (Redis) que permite:
- Procesamiento asíncrono (frontend no se bloquea)
- Múltiples workers en paralelo
- Recuperación ante fallos (retry)
- Progreso en tiempo real

Uso:
    # Iniciar un worker
    cd Agentes && uv run python src/worker.py
    
    # Múltiples workers (procesar en paralelo)
    uv run python src/worker.py &
    uv run python src/worker.py &
    uv run python src/worker.py &

Variables de entorno:
    REDIS_URL=redis://localhost:6379/0
    SUPABASE_URL=...
    SUPABASE_KEY=...
"""

import asyncio
import json
import os
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any

import redis
import structlog

# Agregar paths para imports
SRC_DIR = Path(__file__).parent
AGENTES_DIR = SRC_DIR.parent
sys.path.insert(0, str(AGENTES_DIR))
sys.path.insert(0, str(SRC_DIR))

try:
    from src.agents.etl_agent import run_etl_pipeline
    from src.agents.sentiment_agent import run_sentiment_analysis
    from src.agents.intent_agent import run_intent_analysis
    from src.agents.analyst_agent import run_analyst
    from src.db.supabase_client import get_supabase
    from src.db.writer import upsert_messages_batch
    from src.db.qdrant_store import COLLECTION_NAME, ensure_collection_exists, get_qdrant
except ImportError as e:
    print(f"Error importando módulos: {e}")
    print("Asegurate de estar en el directorio Agentes/")
    sys.exit(1)

log = structlog.get_logger()

# Configuración
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_NAME = "jobs:pending"
QUEUE_PROCESSING = "jobs:processing"
QUEUE_COMPLETED = "jobs:completed"
QUEUE_FAILED = "jobs:failed"
MAX_RETRIES = 3
RETRY_DELAY = 5  # segundos


def get_redis() -> redis.Redis:
    """Conecta a Redis."""
    return redis.from_url(REDIS_URL, decode_responses=True)


def update_job_status(redis_client: redis.Redis, job_id: str, update: dict) -> None:
    """Actualiza el estado de un job en Redis."""
    key = f"job:{job_id}"
    current = redis_client.hgetall(key)
    
    # Merge con datos existentes
    data = {**current, **update, "updated_at": datetime.utcnow().isoformat()}
    redis_client.hset(key, mapping=data)
    
    # Publicar evento de progreso para WebSocket/polling
    redis_client.publish(f"jobs:progress:{job_id}", json.dumps(data))


async def process_etl(job: dict, redis_client: redis.Redis) -> dict:
    """Procesa etapa ETL."""
    job_id = job["id"]
    corpus_path = job["corpus"]
    
    log.info("worker_etl_start", job_id=job_id, corpus=corpus_path)
    update_job_status(redis_client, job_id, {
        "status": "processing",
        "stage": "etl",
        "progress": "5",
        "message": "Iniciando ETL..."
    })
    
    try:
        def etl_progress(done: int, total: int, phase: str) -> None:
            if total > 0:
                pct = 5 + int((done / total) * 20)  # ETL ocupa 5-25%
                update_job_status(redis_client, job_id, {
                    "progress": str(pct),
                    "message": f"ETL embeddings: {done:,}/{total:,} vectores ({int(done/total*100)}%)",
                })

        result = await run_etl_pipeline(corpus_path, use_db=True, on_progress=etl_progress)
        
        update_job_status(redis_client, job_id, {
            "progress": "25",
            "message": f"ETL completado: {result.get('total_msgs', 0):,} mensajes",
            "stats": json.dumps(result)
        })
        
        log.info("worker_etl_done", job_id=job_id, msgs=result.get("total_msgs"))
        return {"success": True, "stats": result}
        
    except Exception as e:
        log.error("worker_etl_failed", job_id=job_id, error=str(e))
        return {"success": False, "error": str(e)}


async def process_sentiment(job: dict, redis_client: redis.Redis) -> dict:
    """Procesa etapa Sentiment."""
    job_id = job["id"]
    
    log.info("worker_sentiment_start", job_id=job_id)
    update_job_status(redis_client, job_id, {
        "stage": "sentiment",
        "progress": "30",
        "message": "Clasificando sentimientos con LLM..."
    })
    
    try:
        result = await run_sentiment_analysis("", use_db=True)
        
        update_job_status(redis_client, job_id, {
            "progress": "60",
            "message": f"Sentiment completado: {result.get('labeled', 0)} mensajes"
        })
        
        log.info("worker_sentiment_done", job_id=job_id, labeled=result.get("labeled"))
        return {"success": True, "stats": result}
        
    except Exception as e:
        log.error("worker_sentiment_failed", job_id=job_id, error=str(e))
        return {"success": False, "error": str(e)}


async def process_intent(job: dict, redis_client: redis.Redis) -> dict:
    """Procesa etapa Intent."""
    job_id = job["id"]
    
    log.info("worker_intent_start", job_id=job_id)
    update_job_status(redis_client, job_id, {
        "stage": "intent",
        "progress": "60",
        "message": "Detectando intenciones con LLM..."
    })
    
    try:
        result = await run_intent_analysis("", use_db=True)
        
        update_job_status(redis_client, job_id, {
            "progress": "90",
            "message": f"Intent completado: {result.get('enriched', 0)} mensajes"
        })
        
        log.info("worker_intent_done", job_id=job_id, enriched=result.get("enriched"))
        return {"success": True, "stats": result}
        
    except Exception as e:
        log.error("worker_intent_failed", job_id=job_id, error=str(e))
        return {"success": False, "error": str(e)}


async def process_analyst(job: dict, redis_client: redis.Redis) -> dict:
    """Procesa etapa Analyst."""
    job_id = job["id"]
    
    log.info("worker_analyst_start", job_id=job_id)
    update_job_status(redis_client, job_id, {
        "stage": "analyst",
        "progress": "90",
        "message": "Generando métricas y reportes..."
    })
    
    try:
        result = await run_analyst(enriched_path="", use_db=True, smart_recommendations=True)
        
        update_job_status(redis_client, job_id, {
            "progress": "100",
            "message": "Pipeline completado",
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat()
        })
        
        log.info("worker_analyst_done", job_id=job_id, report=result.get("report_path"))
        return {"success": True, "stats": result}
        
    except Exception as e:
        log.error("worker_analyst_failed", job_id=job_id, error=str(e))
        return {"success": False, "error": str(e)}


async def process_embeddings(job: dict, redis_client: redis.Redis) -> dict:
    """
    Etapa de embeddings: lee mensajes de Supabase que no tienen vector en Qdrant
    y los vectoriza con Cohere, luego los inserta en la colección conversaai_messages.
    """
    job_id = job["id"]

    log.info("worker_embeddings_start", job_id=job_id)
    update_job_status(redis_client, job_id, {
        "stage": "embeddings",
        "progress": "70",
        "message": "Obteniendo mensajes sin vectorizar desde Supabase..."
    })

    try:
        sb = get_supabase()
        # Obtener todos los mensajes que tengan intent (ya procesados) pero no
        # necesariamente vectorizados en Qdrant.
        rows = sb.table("messages").select("*").execute().data
        if not rows:
            return {"success": True, "stats": {"embedded": 0, "message": "Sin mensajes en BD"}}

        total = len(rows)
        log.info("worker_embeddings_rows_fetched", total=total)
        update_job_status(redis_client, job_id, {
            "progress": "72",
            "message": f"Vectorizando {total:,} mensajes con Cohere (puede tardar)..."
        })

        # upsert_messages_batch ya maneja batching y Qdrant upsert
        def on_embed_progress(done: int, total_: int) -> None:
            pct = 72 + int((done / max(total_, 1)) * 20)  # 72% -> 92%
            update_job_status(redis_client, job_id, {
                "progress": str(pct),
                "message": f"Embeddings: {done:,}/{total_:,} ({int(done/max(total_,1)*100)}%)"
            })

        upsert_messages_batch(rows, embed=True)

        # Verificar cuántos puntos hay en Qdrant
        qdrant = get_qdrant()
        ensure_collection_exists(qdrant)
        info = qdrant.get_collection(COLLECTION_NAME)
        points_count = info.points_count or 0

        update_job_status(redis_client, job_id, {
            "progress": "95",
            "message": f"Embeddings completados: {points_count:,} vectores en Qdrant"
        })

        log.info("worker_embeddings_done", job_id=job_id, points=points_count)
        return {"success": True, "stats": {"embedded": total, "qdrant_points": points_count}}

    except Exception as e:
        log.error("worker_embeddings_failed", job_id=job_id, error=str(e))
        return {"success": False, "error": str(e)}


async def process_job(job_data: dict, redis_client: redis.Redis) -> bool:
    """
    Procesa un job completo (todas las etapas).
    Retorna True si exitoso, False si falló.
    """
    job_id = job_data["id"]
    stages = job_data.get("stages", ["etl", "sentiment", "intent", "analyst"])
    
    log.info("worker_job_start", job_id=job_id, stages=stages)
    
    # Mover de pending a processing
    redis_client.lrem(QUEUE_NAME, 0, json.dumps(job_data))
    redis_client.lpush(QUEUE_PROCESSING, json.dumps(job_data))
    
    try:
        # Procesar cada etapa secuencialmente
        for stage in stages:
            update_job_status(redis_client, job_id, {
                "current_stage": stage,
                "message": f"Procesando {stage}..."
            })
            
            if stage == "etl":
                result = await process_etl(job_data, redis_client)
            elif stage == "sentiment":
                result = await process_sentiment(job_data, redis_client)
            elif stage == "intent":
                result = await process_intent(job_data, redis_client)
            elif stage == "embeddings":
                result = await process_embeddings(job_data, redis_client)
            elif stage == "analyst":
                result = await process_analyst(job_data, redis_client)
            else:
                log.warning("worker_unknown_stage", stage=stage)
                continue
            
            if not result["success"]:
                raise RuntimeError(f"Stage {stage} failed: {result.get('error')}")
        
        # Marcar como completado en el hash
        update_job_status(redis_client, job_id, {
            "status": "completed",
            "progress": "100",
            "message": "Pipeline completado exitosamente",
            "completed_at": datetime.utcnow().isoformat(),
        })
        
        # Mover a completados
        redis_client.lrem(QUEUE_PROCESSING, 0, json.dumps(job_data))
        job_data["completed_at"] = datetime.utcnow().isoformat()
        redis_client.lpush(QUEUE_COMPLETED, json.dumps(job_data))
        
        log.info("worker_job_done", job_id=job_id)
        return True
        
    except Exception as e:
        log.error("worker_job_failed", job_id=job_id, error=str(e))
        
        # Mover a fallados o reintentar
        redis_client.lrem(QUEUE_PROCESSING, 0, json.dumps(job_data))
        
        retries = job_data.get("retries", 0)
        if retries < MAX_RETRIES:
            job_data["retries"] = retries + 1
            job_data["error"] = str(e)
            job_data["retry_at"] = (datetime.utcnow().isoformat())
            
            log.info("worker_job_retry", job_id=job_id, attempt=retries + 1)
            await asyncio.sleep(RETRY_DELAY)
            redis_client.lpush(QUEUE_NAME, json.dumps(job_data))
        else:
            job_data["failed_at"] = datetime.utcnow().isoformat()
            job_data["error"] = str(e)
            job_data["traceback"] = traceback.format_exc()
            redis_client.lpush(QUEUE_FAILED, json.dumps(job_data))
            
            update_job_status(redis_client, job_id, {
                "status": "failed",
                "error": str(e),
                "message": f"Falló después de {MAX_RETRIES} intentos"
            })
        
        return False


async def run_worker_async():
    """Loop principal del worker (async)."""
    log.info("worker_starting", redis=REDIS_URL, queue=QUEUE_NAME)
    
    redis_client = get_redis()
    
    # Verificar conexión
    try:
        redis_client.ping()
        log.info("worker_redis_connected")
    except Exception as e:
        log.error("worker_redis_failed", error=str(e))
        sys.exit(1)
    
    while True:
        try:
            # Bloquear esperando un job (timeout 30s)
            log.debug("worker_waiting_job")
            result = redis_client.brpop(QUEUE_NAME, timeout=30)
            
            if result is None:
                # Timeout, continuar loop
                await asyncio.sleep(0.1)
                continue
            
            queue_name, job_json = result
            log.info("worker_raw_job_received", queue=queue_name, raw=job_json[:100])
            
            try:
                job = json.loads(job_json)
            except json.JSONDecodeError as je:
                log.error("worker_json_parse_error", error=str(je), raw=job_json[:200])
                continue
            
            log.info("worker_job_received", job_id=job.get("id"), stages=job.get("stages"))
            
            # Procesar el job
            success = await process_job(job, redis_client)
            
            if success:
                log.info("worker_job_success", job_id=job.get("id"))
            else:
                log.warning("worker_job_failed", job_id=job.get("id"))
                
        except KeyboardInterrupt:
            log.info("worker_stopping")
            break
        except Exception as e:
            log.error("worker_error", error=str(e), traceback=traceback.format_exc())
            await asyncio.sleep(1)  # Evitar spin loop en error
    
    log.info("worker_stopped")


def run_worker():
    """Entry point síncrono para el worker."""
    asyncio.run(run_worker_async())


if __name__ == "__main__":
    run_worker()
