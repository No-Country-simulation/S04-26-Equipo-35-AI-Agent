"""
Supabase Client — Singleton de conexión a Supabase (PostgreSQL).

Uso:
    from src.db.supabase_client import get_supabase

    sb = get_supabase()
    sb.table("messages").insert({...}).execute()
"""
import os
from functools import lru_cache

import structlog
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()
log = structlog.get_logger()


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """
    Crea y retorna un cliente singleton de Supabase.

    Requiere en .env:
        SUPABASE_URL=https://<proyecto>.supabase.co
        SUPABASE_KEY=<anon o service_role key>

    Returns:
        Cliente de Supabase listo para usar.

    Raises:
        RuntimeError: Si faltan las variables de entorno.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Variables SUPABASE_URL y SUPABASE_KEY son requeridas en .env. "
            "Crea un proyecto en https://supabase.com y copia las credenciales."
        )

    client = create_client(url, key)
    log.info("supabase_connected", url=url[:40] + "...")
    return client
