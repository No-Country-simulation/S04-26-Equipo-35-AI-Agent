"""
Fixtures compartidos para tests del ConversaAI Crew.
Usa datos mock — nunca corpus real.
"""
import json
from pathlib import Path

import pandas as pd
import pytest


MOCK_CORPUS_ROWS = [
    {
        "session_id": "SES-001",
        "usuario": "@miniKittyLuna",
        "fecha": "2026-05-01 00:01:00",
        "region": "LATAM",
        "intencion": "logistica_envio",
        "nivel_frustracion": 0,
        "texto_espanol": "Hola, quiero saber mi saldo",
        "texto_portugues": "Olá, quero saber meu saldo",
        "es_churn_risk": 0
    },
    {
        "session_id": "SES-001",
        "usuario": "@miniKittyLuna",
        "fecha": "2026-05-01 00:02:00",
        "region": "LATAM",
        "intencion": "logistica_envio",
        "nivel_frustracion": 1,
        "texto_espanol": "Llevo días esperando y nada.",
        "texto_portugues": "Estou há dias esperando e nada.",
        "es_churn_risk": 0
    },
    {
        "session_id": "SES-001",
        "usuario": "@miniKittyLuna",
        "fecha": "2026-05-01 00:44:00",
        "region": "LATAM",
        "intencion": "logistica_envio",
        "nivel_frustracion": 2,
        "texto_espanol": "Son pésimos repartiendo.",
        "texto_portugues": "Quero cancelar minha compra agora!",
        "es_churn_risk": 1
    },
    {
        "session_id": "SES-002",
        "usuario": "@soyCoder_ai",
        "fecha": "2026-05-04 00:23:00",
        "region": "BRAZIL",
        "intencion": "problema_pago",
        "nivel_frustracion": 0,
        "texto_espanol": "Hola, mi pago falló.",
        "texto_portugues": "Olá, meu pagamento falhou.",
        "es_churn_risk": 0
    },
    {
        "session_id": "SES-002",
        "usuario": "@soyCoder_ai",
        "fecha": "2026-05-04 00:24:00",
        "region": "BRAZIL",
        "intencion": "problema_pago",
        "nivel_frustracion": 1,
        "texto_espanol": "Sigo esperando mi reembolso.",
        "texto_portugues": "Ainda espero meu reembolso.",
        "es_churn_risk": 0
    },
    {
        "session_id": "SES-002",
        "usuario": "@soyCoder_ai",
        "fecha": "2026-05-04 00:25:00",
        "region": "BRAZIL",
        "intencion": "problema_pago",
        "nivel_frustracion": 2,
        "texto_espanol": "Esto es un robo!",
        "texto_portugues": "Exijo meu dinheiro de volta agora.",
        "es_churn_risk": 1
    }
]

MOCK_PROCESSED_TURNS = [
    {
        "session_id": "SES-001",
        "turn_id": 0,
        "usuario": "@miniKittyLuna",
        "fecha": "2026-05-01 00:01:00",
        "region": "LATAM",
        "lang": "es",
        "text_clean": "hola quiero saber mi saldo",
        "texto_espanol": "Hola, quiero saber mi saldo",
        "texto_portugues": "Olá, quero saber meu saldo",
        "intencion_original": "logistica_envio",
        "nivel_frustracion": 0,
        "es_churn_risk": False
    },
    {
        "session_id": "SES-001",
        "turn_id": 1,
        "usuario": "@miniKittyLuna",
        "fecha": "2026-05-01 00:02:00",
        "region": "LATAM",
        "lang": "es",
        "text_clean": "llevo dias esperando y nada",
        "texto_espanol": "Llevo días esperando y nada.",
        "texto_portugues": "Estou há dias esperando e nada.",
        "intencion_original": "logistica_envio",
        "nivel_frustracion": 1,
        "es_churn_risk": False
    },
    {
        "session_id": "SES-001",
        "turn_id": 2,
        "usuario": "@miniKittyLuna",
        "fecha": "2026-05-01 00:44:00",
        "region": "LATAM",
        "lang": "es",
        "text_clean": "son pesimos repartiendo",
        "texto_espanol": "Son pésimos repartiendo.",
        "texto_portugues": "Quero cancelar minha compra agora!",
        "intencion_original": "logistica_envio",
        "nivel_frustracion": 2,
        "es_churn_risk": True
    },
    {
        "session_id": "SES-002",
        "turn_id": 0,
        "usuario": "@soyCoder_ai",
        "fecha": "2026-05-04 00:23:00",
        "region": "BRAZIL",
        "lang": "pt",
        "text_clean": "ola meu pagamento falhou",
        "texto_espanol": "Hola, mi pago falló.",
        "texto_portugues": "Olá, meu pagamento falhou.",
        "intencion_original": "problema_pago",
        "nivel_frustracion": 0,
        "es_churn_risk": False
    },
    {
        "session_id": "SES-002",
        "turn_id": 1,
        "usuario": "@soyCoder_ai",
        "fecha": "2026-05-04 00:24:00",
        "region": "BRAZIL",
        "lang": "pt",
        "text_clean": "ainda espero meu reembolso",
        "texto_espanol": "Sigo esperando mi reembolso.",
        "texto_portugues": "Ainda espero meu reembolso.",
        "intencion_original": "problema_pago",
        "nivel_frustracion": 1,
        "es_churn_risk": False
    },
    {
        "session_id": "SES-002",
        "turn_id": 2,
        "usuario": "@soyCoder_ai",
        "fecha": "2026-05-04 00:25:00",
        "region": "BRAZIL",
        "lang": "pt",
        "text_clean": "exijo meu dinheiro de volta agora",
        "texto_espanol": "Esto es un robo!",
        "texto_portugues": "Exijo meu dinheiro de volta agora.",
        "intencion_original": "problema_pago",
        "nivel_frustracion": 2,
        "es_churn_risk": True
    }
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
