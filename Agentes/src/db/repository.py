import os
import uuid
import logging
from typing import Dict, Any, List
from supabase import create_client, Client
from qdrant_client import QdrantClient
from qdrant_client.http import models
import cohere

log = logging.getLogger(__name__)

class DBRepository:
    def __init__(self):
        # 1. Supabase Initialization
        supa_url = os.getenv("SUPABASE_URL")
        supa_key = os.getenv("SUPABASE_KEY")
        if not supa_url or not supa_key:
            log.warning("Faltan credenciales de Supabase en el .env. La DB no funcionará.")
            self.supabase = None
        else:
            self.supabase: Client = create_client(supa_url, supa_key)

        # 2. Qdrant Initialization
        try:
            self.qdrant = QdrantClient("localhost", port=6333)
            self._ensure_qdrant_collection()
        except Exception as e:
            log.warning(f"No se pudo conectar a Qdrant (asegúrate de correr docker compose up -d): {e}")
            self.qdrant = None

        # 3. Cohere Initialization
        cohere_key = os.getenv("COHERE_API_KEY")
        if not cohere_key:
            log.warning("Falta COHERE_API_KEY en el .env. No se crearán embeddings.")
            self.cohere = None
        else:
            self.cohere = cohere.Client(cohere_key)

    def _ensure_qdrant_collection(self):
        """Asegura que la colección de vectors exista."""
        if not self.qdrant:
            return
        try:
            collections = self.qdrant.get_collections().collections
            if not any(c.name == "messages" for c in collections):
                self.qdrant.create_collection(
                    collection_name="messages",
                    vectors_config=models.VectorParams(
                        size=1024, # embed-multilingual-v3.0 utiliza 1024 dimensiones
                        distance=models.Distance.COSINE
                    )
                )
                log.info("Colección 'messages' creada en Qdrant.")
        except Exception as e:
            log.error(f"Error verificando colección Qdrant: {e}")

    def generate_embedding(self, text: str) -> List[float]:
        if not self.cohere:
            return [0.0] * 1024
        try:
            response = self.cohere.embed(
                texts=[text],
                model="embed-multilingual-v3.0",
                input_type="search_document"
            )
            return response.embeddings[0]
        except Exception as e:
            log.error(f"Error generando embedding: {e}")
            return [0.0] * 1024

    def save_session(self, session_data: Dict[str, Any]):
        """Upsert a session in Supabase"""
        if not self.supabase:
            return
        try:
            # Asegurarnos de que no enviemos campos que no existen en la BD
            allowed_keys = [
                'id', 'usuario', 'region', 'total_turns', 'avg_frustration_score',
                'max_frustration_score', 'has_escalation', 'has_abandonment',
                'dominant_intent', 'resolution_rate', 'is_churn_risk', 'created_at'
            ]
            clean_data = {k: v for k, v in session_data.items() if k in allowed_keys}
            
            # Normalizar region para el CHECK constraint de Supabase
            region = clean_data.get("region", "").upper()
            if region not in ('LATAM', 'BRAZIL', 'EUROPE'):
                clean_data["region"] = 'LATAM' if region not in ('PORTUGAL', 'SPAIN') else 'EUROPE'
            
            self.supabase.table("sessions").upsert(clean_data).execute()
        except Exception as e:
            log.error(f"Error guardando session {session_data.get('id')}: {e}")

    def save_message(self, message_data: Dict[str, Any]):
        """Inserta un mensaje en Supabase y Qdrant"""
        try:
            text_to_embed = message_data.get("text_clean", "")
            qdrant_point_id = str(uuid.uuid4())
            
            # Solo guardamos en Qdrant si hay texto y cliente
            if self.qdrant and text_to_embed:
                vector = self.generate_embedding(text_to_embed)
                self.qdrant.upsert(
                    collection_name="messages",
                    points=[
                        models.PointStruct(
                            id=qdrant_point_id,
                            payload={
                                "session_id": message_data.get("session_id"),
                                "turn_id": message_data.get("turn_id"),
                                "text": text_to_embed,
                                "sentiment": message_data.get("sentiment_label"),
                                "intent": message_data.get("intent_label")
                            },
                            vector=vector
                        )
                    ]
                )
            
            # Guardamos en Supabase
            if self.supabase:
                allowed_keys = [
                    'session_id', 'turn_id', 'fecha', 'region', 'texto_espanol',
                    'texto_portugues', 'text_clean', 'intencion_original',
                    'nivel_frustracion', 'es_churn_risk', 'sentiment_label',
                    'sentiment_score', 'escalation', 'abandonment_risk',
                    'intent_label', 'intent_confidence', 'resolved', 'qdrant_point_id'
                ]
                clean_data = {k: v for k, v in message_data.items() if k in allowed_keys}
                clean_data["qdrant_point_id"] = qdrant_point_id
                
                self.supabase.table("messages").upsert(clean_data).execute()
                
        except Exception as e:
            log.error(f"Error guardando message {message_data.get('session_id')}-{message_data.get('turn_id')}: {e}")
