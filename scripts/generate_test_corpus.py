"""
Genera un CSV de prueba con datos variados y realistas para testear el pipeline completo.

Columnas: session_id, usuario, fecha, region, intencion, nivel_frustracion,
          texto_espanol, texto_portugues, es_churn_risk

Los session_id usan el prefijo TEST- para no colisionar con datos reales.
Ejecutar: python scripts/generate_test_corpus.py [--rows 300] [--output Agentes/data/raw/test_rich_corpus.csv]
"""

import csv
import random
import argparse
from datetime import datetime, timedelta

INTENTS = [
    "logistica_envio",
    "devolucion_reembolso",
    "problema_pago",
    "consulta_producto",
    "cancelacion_pedido",
    "soporte_tecnico",
    "cambio_contrasena",
    "facturacion",
    "estado_cuenta",
    "queja_servicio",
]

REGIONS = ["LATAM", "BRAZIL", "LATAM", "LATAM", "BRAZIL"]  # más peso a LATAM

MESSAGES_ES: dict[str, list[str]] = {
    "logistica_envio": [
        "¿Dónde está mi pedido?",
        "Llevo días esperando y nada.",
        "Mi paquete no llegó en la fecha prometida.",
        "El seguimiento no se actualiza hace 3 días.",
        "¿Cuándo llega mi pedido? Ya pasó la fecha.",
        "El courier dice que fue entregado pero yo no lo recibí.",
        "Necesito saber el estado de mi envío urgente.",
    ],
    "devolucion_reembolso": [
        "Quiero devolver un producto.",
        "Me llegó un producto defectuoso, quiero el reembolso.",
        "¿Cómo proceso una devolución?",
        "Solicité el reembolso hace 2 semanas y no llegó.",
        "El producto no era lo que esperaba, quiero devolverlo.",
        "Necesito el dinero de vuelta lo antes posible.",
    ],
    "problema_pago": [
        "Mi pago no fue procesado.",
        "Me cobraron dos veces el mismo pedido.",
        "La tarjeta fue rechazada pero el dinero fue descontado.",
        "No puedo completar el pago, da error.",
        "¿Por qué se rechazó mi tarjeta?",
        "Me debitaron pero el pedido no quedó confirmado.",
    ],
    "consulta_producto": [
        "¿Este producto es compatible con mi modelo?",
        "¿Tienen talle L disponible?",
        "¿Cuándo vuelve a haber stock?",
        "¿Este artículo tiene garantía?",
        "¿Cuáles son las especificaciones técnicas?",
        "¿Puedo usarlo en 220v?",
    ],
    "cancelacion_pedido": [
        "Quiero cancelar mi pedido.",
        "¿Puedo cancelar si ya fue despachado?",
        "Cometí un error en la dirección, necesito cancelar.",
        "Ya no necesito el pedido, ¿cómo lo cancelo?",
        "Me urge cancelar antes de que salga.",
    ],
    "soporte_tecnico": [
        "El producto no enciende.",
        "La aplicación no funciona.",
        "Tengo un error al intentar ingresar.",
        "La pantalla quedó en negro.",
        "No puedo conectarme a wifi.",
        "El dispositivo se reinicia solo.",
    ],
    "cambio_contrasena": [
        "Olvidé mi contraseña.",
        "No puedo ingresar a mi cuenta.",
        "El link de recuperación no llega.",
        "Necesito resetear mi contraseña.",
        "Cambié el mail y ahora no puedo entrar.",
    ],
    "facturacion": [
        "Necesito la factura de mi compra.",
        "La factura tiene un error en mis datos.",
        "¿Cómo descargo la factura?",
        "No recibí la factura por mail.",
        "Necesito factura A, no B.",
    ],
    "estado_cuenta": [
        "¿Cuál es mi saldo disponible?",
        "¿Por qué se descontaron puntos de mi cuenta?",
        "Mi cuenta fue bloqueada sin razón.",
        "No puedo ver el historial de compras.",
        "Mis puntos no se acreditaron.",
    ],
    "queja_servicio": [
        "La atención que recibí fue pésima.",
        "Llevo horas esperando una respuesta.",
        "Nadie me resuelve el problema.",
        "Es la tercera vez que llamo por lo mismo.",
        "Esto es una falta de respeto.",
        "Voy a dejar de usar este servicio.",
        "Nunca más compro acá.",
    ],
}

MESSAGES_PT: dict[str, list[str]] = {
    "logistica_envio": [
        "Onde está meu pedido?",
        "Estou há dias esperando e nada.",
        "Meu pacote não chegou na data prometida.",
        "O rastreamento não atualiza há 3 dias.",
        "Quando chega meu pedido? Já passou da data.",
        "O courier diz que foi entregue mas eu não recebi.",
    ],
    "devolucion_reembolso": [
        "Quero devolver um produto.",
        "Recebi um produto com defeito, quero reembolso.",
        "Como faço uma devolução?",
        "Solicitei o reembolso há 2 semanas e não chegou.",
    ],
    "problema_pago": [
        "Meu pagamento não foi processado.",
        "Me cobraram duas vezes o mesmo pedido.",
        "O cartão foi recusado mas o dinheiro foi debitado.",
        "Não consigo concluir o pagamento, dá erro.",
    ],
    "consulta_produto": [
        "Este produto é compatível com meu modelo?",
        "Tem tamanho L disponível?",
        "Quando volta a ter estoque?",
        "Este item tem garantia?",
    ],
    "cancelacion_pedido": [
        "Quero cancelar meu pedido.",
        "Posso cancelar se já foi despachado?",
        "Errei o endereço, preciso cancelar.",
    ],
    "soporte_tecnico": [
        "O produto não liga.",
        "O aplicativo não funciona.",
        "Tenho um erro ao tentar entrar.",
        "A tela ficou preta.",
    ],
    "cambio_contrasena": [
        "Esqueci minha senha.",
        "Não consigo entrar na minha conta.",
        "O link de recuperação não chega.",
    ],
    "facturacion": [
        "Preciso da nota fiscal da minha compra.",
        "A nota fiscal tem um erro nos meus dados.",
        "Como baixo a nota fiscal?",
    ],
    "estado_cuenta": [
        "Qual é o meu saldo disponível?",
        "Por que foram descontados pontos da minha conta?",
        "Minha conta foi bloqueada sem motivo.",
    ],
    "queja_servicio": [
        "O atendimento que recebi foi péssimo.",
        "Estou esperando horas por uma resposta.",
        "Ninguém resolve meu problema.",
        "É a terceira vez que ligo pelo mesmo assunto.",
        "Isso é falta de respeito.",
        "Vou parar de usar este serviço.",
    ],
}

USERNAMES = [
    "@user_latam_{}", "@cliente_{}", "@usuario_{}", "@comprador_{}", "@mx_user_{}",
    "@ar_cliente_{}", "@co_user_{}", "@pe_cliente_{}", "@br_user_{}", "@pt_cliente_{}",
]


def random_date(start: datetime, end: datetime) -> str:
    delta = end - start
    return (start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))).strftime("%Y-%m-%d %H:%M:%S")


def make_session(session_num: int, intent: str, region: str, n_turns: int, base_frustration: int) -> list[dict]:
    session_id = f"TEST-{session_num:05d}"
    username = random.choice(USERNAMES).format(random.randint(100, 9999))
    start = datetime(2026, 1, 1)
    end = datetime(2026, 5, 18)

    use_pt = region == "BRAZIL"
    msgs_es = MESSAGES_ES.get(intent, ["Tengo una consulta."])
    msgs_pt = MESSAGES_PT.get(intent, ["Tenho uma dúvida."])

    rows = []
    for turn in range(n_turns):
        # Frustración sube progresivamente, máximo 2 (schema ETL: ge=0, le=2)
        frustration = min(base_frustration + (turn // 2), 2)
        is_churn = 1 if frustration >= 2 and intent in ("queja_servicio", "devolucion_reembolso", "problema_pago") else 0

        text_es = random.choice(msgs_es)
        text_pt = random.choice(msgs_pt) if use_pt else ""

        rows.append({
            "session_id": session_id,
            "usuario": username,
            "fecha": random_date(start, end),
            "region": region,
            "intencion": intent,
            "nivel_frustracion": frustration,
            "texto_espanol": text_es,
            "texto_portugues": text_pt,
            "es_churn_risk": is_churn,
        })
    return rows


def generate(n_rows: int, output_path: str) -> None:
    random.seed(42)
    all_rows: list[dict] = []
    session_num = 1

    # Distribución de intents — más peso a los problemáticos para métricas interesantes
    intent_weights = [3, 3, 3, 2, 2, 2, 1, 1, 1, 4]  # más queja_servicio y pagos
    intent_pool = []
    for intent, weight in zip(INTENTS, intent_weights):
        intent_pool.extend([intent] * weight)

    while len(all_rows) < n_rows:
        intent = random.choice(intent_pool)
        region = random.choice(REGIONS)
        # Intents con alta frustración tienen sesiones más largas
        if intent in ("queja_servicio", "problema_pago", "logistica_envio"):
            n_turns = random.randint(3, 8)
            base_frustration = random.randint(1, 2)
        elif intent in ("devolucion_reembolso", "cancelacion_pedido"):
            n_turns = random.randint(2, 5)
            base_frustration = random.randint(1, 2)
        else:
            n_turns = random.randint(1, 4)
            base_frustration = random.randint(0, 1)

        rows = make_session(session_num, intent, region, n_turns, base_frustration)
        all_rows.extend(rows)
        session_num += 1

    all_rows = all_rows[:n_rows]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "session_id", "usuario", "fecha", "region", "intencion",
            "nivel_frustracion", "texto_espanol", "texto_portugues", "es_churn_risk",
        ], quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(all_rows)

    sessions = len({r["session_id"] for r in all_rows})
    print(f"✓ Generado: {output_path}")
    print(f"  {len(all_rows)} mensajes / {sessions} sesiones únicas")
    print(f"  Intents: {len(INTENTS)} tipos | Regiones: LATAM + BRAZIL")
    print(f"  Session IDs: TEST-00001 … TEST-{sessions:05d} (no colisionan con datos reales)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Genera corpus de prueba para el pipeline")
    parser.add_argument("--rows", type=int, default=300, help="Cantidad de mensajes a generar (default: 300)")
    parser.add_argument("--output", type=str, default="Agentes/data/raw/test_rich_corpus.csv", help="Ruta de salida")
    args = parser.parse_args()
    generate(args.rows, args.output)
