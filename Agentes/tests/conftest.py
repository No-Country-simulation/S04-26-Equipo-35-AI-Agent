"""
Fixtures compartidos para tests del ConversaAI Crew.
Usa datos mock — nunca corpus real.
"""
import json
from pathlib import Path

import pandas as pd
import pytest


MOCK_CORPUS_ROWS = [
    {"session_id": "SES-001", "timestamp": "2025-05-01 10:00:00", "speaker": "user", "text": "Hola, quiero saber mi saldo"},
    {"session_id": "SES-001", "timestamp": "2025-05-01 10:00:30", "speaker": "bot", "text": "Bienvenido, ¿cuál es tu número de cuenta?"},
    {"session_id": "SES-001", "timestamp": "2025-05-01 10:01:00", "speaker": "user", "text": "12345678"},
    {"session_id": "SES-001", "timestamp": "2025-05-01 10:01:30", "speaker": "bot", "text": "Tu saldo es $150.00"},
    {"session_id": "SES-001", "timestamp": "2025-05-01 10:02:00", "speaker": "user", "text": "Gracias, perfecto"},
    # Sesión con frustración y escalada
    {"session_id": "SES-002", "timestamp": "2025-05-01 11:00:00", "speaker": "user", "text": "no funciona mi app desde hace 3 días"},
    {"session_id": "SES-002", "timestamp": "2025-05-01 11:00:30", "speaker": "bot", "text": "Lamentamos el inconveniente. ¿Puede describir el error?"},
    {"session_id": "SES-002", "timestamp": "2025-05-01 11:01:00", "speaker": "user", "text": "ya les dije, no carga nada, qué mal servicio"},
    {"session_id": "SES-002", "timestamp": "2025-05-01 11:01:30", "speaker": "bot", "text": "Entiendo. ¿Probó reiniciar la app?"},
    {"session_id": "SES-002", "timestamp": "2025-05-01 11:02:00", "speaker": "user", "text": "CLARO QUE SÍ, CUÁNTAS VECES LES TENGO QUE DECIR, ESTO ES UN ROBO"},
    # Sesión en portugués con abandono
    {"session_id": "SES-003", "timestamp": "2025-05-01 12:00:00", "speaker": "user", "text": "quero cancelar minha assinatura"},
    {"session_id": "SES-003", "timestamp": "2025-05-01 12:00:30", "speaker": "bot", "text": "Olá! Posso ajudar com isso."},
    {"session_id": "SES-003", "timestamp": "2025-05-01 12:01:00", "speaker": "user", "text": "péssimo atendimento, não resolve nada"},
    {"session_id": "SES-003", "timestamp": "2025-05-01 12:01:30", "speaker": "bot", "text": "Pode me dar mais detalhes?"},
    # usuario no responde → abandono
]

MOCK_PROCESSED_TURNS = [
    {"session_id": "SES-001", "turn_id": 0, "speaker": "user", "text_clean": "hola quiero saber mi saldo", "lang": "es"},
    {"session_id": "SES-001", "turn_id": 1, "speaker": "bot", "text_clean": "bienvenido cual es tu numero de cuenta", "lang": "es"},
    {"session_id": "SES-001", "turn_id": 2, "speaker": "user", "text_clean": "12345678", "lang": "es"},
    {"session_id": "SES-001", "turn_id": 3, "speaker": "bot", "text_clean": "tu saldo es $150.00", "lang": "es"},
    {"session_id": "SES-001", "turn_id": 4, "speaker": "user", "text_clean": "gracias perfecto", "lang": "es"},
    {"session_id": "SES-002", "turn_id": 0, "speaker": "user", "text_clean": "no funciona mi app desde hace 3 dias", "lang": "es"},
    {"session_id": "SES-002", "turn_id": 1, "speaker": "bot", "text_clean": "lamentamos el inconveniente puede describir el error", "lang": "es"},
    {"session_id": "SES-002", "turn_id": 2, "speaker": "user", "text_clean": "ya les dije no carga nada que mal servicio", "lang": "es"},
    {"session_id": "SES-002", "turn_id": 3, "speaker": "bot", "text_clean": "entiendo probo reiniciar la app", "lang": "es"},
    {"session_id": "SES-002", "turn_id": 4, "speaker": "user", "text_clean": "claro que si cuantas veces les tengo que decir esto es un robo", "lang": "es"},
]


@pytest.fixture
def mock_corpus_df() -> pd.DataFrame:
    """DataFrame con corpus crudo de prueba."""
    return pd.DataFrame(MOCK_CORPUS_ROWS)


@pytest.fixture
def mock_processed_jsonl(tmp_path: Path) -> Path:
    """Archivo JSONL procesado de prueba."""
    output_file = tmp_path / "processed_corpus.jsonl"
    with open(output_file, "w", encoding="utf-8") as f:
        for turn in MOCK_PROCESSED_TURNS:
            f.write(json.dumps(turn, ensure_ascii=False) + "\n")
    return output_file


@pytest.fixture
def mock_corpus_csv(tmp_path: Path) -> Path:
    """CSV de corpus crudo de prueba."""
    df = pd.DataFrame(MOCK_CORPUS_ROWS)
    csv_path = tmp_path / "corpus_test.csv"
    df.to_csv(csv_path, index=False)
    return csv_path
