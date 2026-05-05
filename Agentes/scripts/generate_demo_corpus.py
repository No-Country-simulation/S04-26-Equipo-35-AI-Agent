"""
Generador de corpus sintético de demo para ConversaAI.

Genera un CSV con ~500 sesiones realistas en ES/PT para validar
el pipeline end-to-end sin depender del corpus real del cliente.

Uso: python scripts/generate_demo_corpus.py
"""
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

# Seed fijo para reproducibilidad
random.seed(42)

# ── Templates de conversación ────────────────────────────────────────────────

INTENTS_ES = {
    "consulta_saldo": {
        "user": [
            "quiero saber mi saldo",
            "cuánto debo este mes",
            "cuál es mi saldo actual",
            "me pueden decir cuánto tengo",
            "necesito ver mi balance",
        ],
        "bot_resolved": [
            "Tu saldo es $150.00. Listo, ¿algo más?",
            "Tu saldo actual es de $234.56. Resuelto.",
            "El balance de tu cuenta es $89.00. Confirmado.",
        ],
        "bot_unresolved": [
            "¿Puedes darme tu número de cuenta?",
            "Necesito verificar tu identidad primero",
            "Un momento, estoy consultando",
        ],
    },
    "reporte_problema": {
        "user": [
            "no funciona la app",
            "la app no carga desde hace 3 días",
            "no puedo entrar a mi cuenta",
            "da error al iniciar sesión",
            "la página se queda en blanco",
        ],
        "bot_resolved": [
            "Ya identificamos el problema, se solucionó. Listo.",
            "Hemos reiniciado tu sesión, debería funcionar. Caso TICKET-{ticket} abierto.",
            "El error fue corregido, ya puedes ingresar. Confirmado.",
        ],
        "bot_unresolved": [
            "¿Probó reiniciar la app?",
            "Entiendo, voy a revisar",
            "¿Puede describir el error con más detalle?",
        ],
    },
    "solicitud_reembolso": {
        "user": [
            "me cobraron de más, quiero reembolso",
            "quiero mi dinero de vuelta",
            "hay un cargo que no reconozco",
            "me cobraron doble",
            "necesito que devuelvan el cobro",
        ],
        "bot_resolved": [
            "Reembolso procesado por $50.00. TICKET-{ticket} generado.",
            "Ya se aplicó la devolución a tu cuenta. Listo.",
            "El cargo fue revertido. Confirmado.",
        ],
        "bot_unresolved": [
            "Necesito el número de referencia del cobro",
            "Voy a escalar esto al área de finanzas",
            "¿Puede enviar captura del cargo?",
        ],
    },
    "cambio_datos": {
        "user": [
            "quiero cambiar mi teléfono",
            "necesito actualizar mi correo",
            "cambiar dirección de facturación",
            "actualizar mis datos personales",
        ],
        "bot_resolved": [
            "Datos actualizados correctamente. Listo.",
            "Tu teléfono fue cambiado. Confirmado.",
            "Correo actualizado exitosamente. Resuelto.",
        ],
        "bot_unresolved": [
            "¿Cuál es el nuevo dato?",
            "Necesito verificar tu identidad",
            "¿Me puede dar su nombre completo?",
        ],
    },
    "consulta_estado": {
        "user": [
            "dónde está mi pedido",
            "cuál es el estado de mi reclamo",
            "qué pasó con mi ticket",
            "hace 5 días hice un pedido y no llega",
        ],
        "bot_resolved": [
            "Tu pedido llega mañana. Número de seguimiento: TR-{ticket}. Listo.",
            "Tu reclamo fue procesado. CASO-{ticket} asignado.",
            "El ticket fue resuelto ayer. Confirmado.",
        ],
        "bot_unresolved": [
            "¿Tiene el número de pedido?",
            "Estoy verificando en el sistema",
            "No encuentro ese pedido, ¿puede verificar?",
        ],
    },
    "queja_servicio": {
        "user": [
            "el servicio es pésimo",
            "quiero hablar con un humano",
            "estoy harto de este bot",
            "qué mal servicio, esto no debería ser así",
            "llevo horas esperando respuesta",
        ],
        "bot_resolved": [
            "Lamento la experiencia. Te transfiero a un agente humano. Listo.",
            "Entiendo tu frustración. Escalé tu caso con prioridad. TICKET-{ticket}.",
        ],
        "bot_unresolved": [
            "Entiendo, ¿puedo ayudarte con algo más?",
            "Lamento el inconveniente",
            "¿Puede ser más específico con el problema?",
        ],
    },
    "solicitud_info": {
        "user": [
            "cómo funciona el plan premium",
            "qué incluye la suscripción",
            "cuáles son los horarios de atención",
            "necesito información sobre los planes",
        ],
        "bot_resolved": [
            "El plan premium incluye X, Y y Z. ¿Algo más? Listo.",
            "Nuestro horario es de 8 a 20h. Resuelto.",
            "Aquí está la info: https://example.com/planes. Confirmado.",
        ],
        "bot_unresolved": [
            "¿Qué plan le interesa?",
            "Un momento, estoy buscando esa información",
            "¿Puede ser más específico?",
        ],
    },
    "cancelacion": {
        "user": [
            "quiero cancelar mi suscripción",
            "dar de baja mi cuenta",
            "cancelar el servicio",
            "no quiero seguir con el plan",
        ],
        "bot_resolved": [
            "Cancelación procesada. Listo, lamentamos que te vayas.",
            "Tu suscripción fue cancelada. Confirmado.",
        ],
        "bot_unresolved": [
            "¿Estás seguro? Tenemos una oferta especial",
            "¿Puedo saber el motivo de la cancelación?",
            "Antes de cancelar, ¿puedo ofrecerte un descuento?",
        ],
    },
}

INTENTS_PT = {
    "consulta_saldo": {
        "user": [
            "quero saber meu saldo",
            "quanto devo este mês",
            "qual é meu saldo atual",
            "preciso ver meu balanço",
        ],
        "bot_resolved": [
            "Seu saldo é R$150.00. Pronto, algo mais?",
            "O saldo da sua conta é R$234.56. Feito.",
        ],
        "bot_unresolved": [
            "Pode me dar seu número de conta?",
            "Preciso verificar sua identidade primeiro",
        ],
    },
    "reporte_problema": {
        "user": [
            "o app não funciona",
            "não consigo entrar na minha conta",
            "dá erro ao fazer login",
            "a página fica em branco há 3 dias",
        ],
        "bot_resolved": [
            "Já identificamos o problema, foi solucionado. Pronto.",
            "Reiniciamos sua sessão. TICKET-{ticket} aberto.",
        ],
        "bot_unresolved": [
            "Tentou reiniciar o app?",
            "Entendo, vou verificar",
        ],
    },
    "queja_servicio": {
        "user": [
            "péssimo atendimento",
            "quero falar com um humano",
            "que absurdo, não resolvem nada",
            "já faz horas que espero",
        ],
        "bot_resolved": [
            "Lamento a experiência. Vou transferir para um atendente. Pronto.",
        ],
        "bot_unresolved": [
            "Entendo, posso ajudar com algo mais?",
            "Lamento o inconveniente",
        ],
    },
    "cancelacion": {
        "user": [
            "quero cancelar minha assinatura",
            "cancelar o serviço",
            "não quero mais o plano",
        ],
        "bot_resolved": [
            "Cancelamento processado. Feito.",
        ],
        "bot_unresolved": [
            "Tem certeza? Temos uma oferta especial",
            "Posso saber o motivo?",
        ],
    },
    "solicitud_reembolso": {
        "user": [
            "cobraram errado, quero reembolso",
            "quero meu dinheiro de volta",
            "tem uma cobrança que não reconheço",
        ],
        "bot_resolved": [
            "Reembolso processado. TICKET-{ticket} gerado. Pronto.",
        ],
        "bot_unresolved": [
            "Preciso do número de referência",
            "Vou escalar para a área financeira",
        ],
    },
}

FRUSTRATION_ESCALATION_ES = [
    "ya les dije, no funciona",
    "CUÁNTAS VECES TENGO QUE REPETIR LO MISMO",
    "esto es un robo 😤😡",
    "PÉSIMO SERVICIO, NO SIRVEN PARA NADA 🤬",
    "llevo 3 días esperando y nada!!!",
    "no me entienden, qué mal servicio",
    "ya chole, quiero hablar con un humano YA",
]

FRUSTRATION_ESCALATION_PT = [
    "já falei, não funciona",
    "QUE ABSURDO, NINGUÉM RESOLVE NADA",
    "péssimo atendimento 😤😡",
    "HORRÍVEL, NÃO SERVEM PARA NADA 🤬",
    "já faz 3 dias e nada!!!",
    "vocês me enganaram, isso é fraude",
]

# Ruido realista
NOISE_TEMPLATES = [
    "[12:34] ",
    "[15:22:01] ",
    " #SES-{sid}",
    " <br>&nbsp;",
    " visita https://example.com/help",
    " 😊👍",
    "",  # sin ruido
    "",
    "",
    "",  # peso hacia sin ruido
]

# ── Tipos de sesión ──────────────────────────────────────────────────────────

SESSION_TYPES = {
    "satisfecha": 0.35,      # 35% sesiones satisfechas
    "neutra": 0.25,          # 25% neutras (resueltas sin emoción)
    "frustrada_resuelta": 0.15,  # 15% frustrantes pero resueltas
    "frustrada_escalada": 0.12,  # 12% con escalada
    "abandono": 0.08,        # 8% abandono
    "multi_intent": 0.05,    # 5% múltiples intenciones
}


def _add_noise(text: str, session_id: str) -> str:
    """Agrega ruido realista a un mensaje."""
    noise = random.choice(NOISE_TEMPLATES)
    noise = noise.replace("{sid}", session_id.split("-")[1] if "-" in session_id else "000")
    return noise + text if noise.startswith("[") else text + noise


def _generate_timestamp(base: datetime, turn: int) -> str:
    """Genera timestamp incrementando ~30s por turno."""
    delta = timedelta(seconds=turn * random.randint(20, 90))
    return (base + delta).strftime("%Y-%m-%d %H:%M:%S")


def _pick_speaker_variant() -> str:
    """Varía el nombre del speaker para probar el mapeo del ETL."""
    return random.choice(["bot", "bot", "bot", "system", "agent"])


def generate_session(
    session_id: str,
    session_type: str,
    lang: str,
    base_time: datetime,
) -> list[dict]:
    """Genera una sesión completa según el tipo."""
    intents = INTENTS_ES if lang == "es" else INTENTS_PT
    escalation_phrases = (
        FRUSTRATION_ESCALATION_ES if lang == "es" else FRUSTRATION_ESCALATION_PT
    )

    # Elegir intent principal
    available_intents = list(intents.keys())
    intent_key = random.choice(available_intents)
    intent_data = intents[intent_key]

    rows: list[dict] = []
    turn = 0

    if session_type == "satisfecha":
        # User pregunta → bot resuelve → user agradece
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(intent_data["user"]), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_resolved"]).replace(
                "{ticket}", str(random.randint(10000, 99999))
            ),
        })
        turn += 1
        thanks = (
            random.choice(["gracias, perfecto", "genial, gracias", "excelente, funcionó"])
            if lang == "es"
            else random.choice(["obrigado, funcionou", "ótimo, resolvido", "perfeito"])
        )
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": thanks,
        })

    elif session_type == "neutra":
        # User pregunta → bot pide info → user da info → bot resuelve
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(intent_data["user"]), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })
        turn += 1
        filler = "12345678" if lang == "es" else "12345678"
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": filler,
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_resolved"]).replace(
                "{ticket}", str(random.randint(10000, 99999))
            ),
        })

    elif session_type == "frustrada_resuelta":
        # User → bot no resuelve → user se frustra → bot resuelve
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(intent_data["user"]), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })
        turn += 1
        # User se frustra
        frustration = (
            random.choice(["no me entiende, ya les dije", "esto ya me tiene harto"])
            if lang == "es"
            else random.choice(["vocês não entendem", "já falei isso"])
        )
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(frustration, session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_resolved"]).replace(
                "{ticket}", str(random.randint(10000, 99999))
            ),
        })
        turn += 1
        ok_msg = "ok gracias" if lang == "es" else "ok obrigado"
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": ok_msg,
        })

    elif session_type == "frustrada_escalada":
        # User → bot falla → user escala → bot falla → user explota
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(intent_data["user"]), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(intent_data["user"]), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })
        turn += 1
        # Escalada
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(escalation_phrases), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": random.choice(escalation_phrases),
        })

    elif session_type == "abandono":
        # User → bot no ayuda → user frustrado → NO responde más
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(random.choice(intent_data["user"]), session_id),
        })
        turn += 1
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })
        turn += 1
        frustration = random.choice(escalation_phrases)
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": "user",
            "text": _add_noise(frustration, session_id),
        })
        turn += 1
        # Bot responde pero user ya se fue
        rows.append({
            "session_id": session_id,
            "timestamp": _generate_timestamp(base_time, turn),
            "speaker": _pick_speaker_variant(),
            "text": random.choice(intent_data["bot_unresolved"]),
        })

    elif session_type == "multi_intent":
        # User hace varias preguntas en la misma sesión
        intents_to_use = random.sample(available_intents, min(3, len(available_intents)))
        for intent in intents_to_use:
            idata = intents[intent]
            rows.append({
                "session_id": session_id,
                "timestamp": _generate_timestamp(base_time, turn),
                "speaker": "user",
                "text": _add_noise(random.choice(idata["user"]), session_id),
            })
            turn += 1
            resolved = random.random() > 0.4
            bot_msgs = idata["bot_resolved"] if resolved else idata["bot_unresolved"]
            rows.append({
                "session_id": session_id,
                "timestamp": _generate_timestamp(base_time, turn),
                "speaker": _pick_speaker_variant(),
                "text": random.choice(bot_msgs).replace(
                    "{ticket}", str(random.randint(10000, 99999))
                ),
            })
            turn += 1

    return rows


def main() -> None:
    """Genera el corpus de demo."""
    output_dir = Path("data/raw")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "demo_corpus.csv"

    all_rows: list[dict] = []
    session_num = 0
    base_date = datetime(2025, 4, 1, 8, 0, 0)

    # Generar sesiones según distribución de tipos
    total_sessions = 500
    for session_type, pct in SESSION_TYPES.items():
        count = int(total_sessions * pct)
        for _ in range(count):
            session_num += 1
            session_id = f"SES-{session_num:05d}"

            # 70% ES, 30% PT
            lang = "pt" if random.random() < 0.3 else "es"

            # Timestamp base aleatorio dentro del mes
            day_offset = random.randint(0, 29)
            hour_offset = random.randint(0, 14)
            session_time = base_date + timedelta(days=day_offset, hours=hour_offset)

            rows = generate_session(session_id, session_type, lang, session_time)
            all_rows.extend(rows)

    # Shuffle para simular llegada no ordenada
    random.shuffle(all_rows)

    # Escribir CSV
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["session_id", "timestamp", "speaker", "text"])
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"✅ Corpus generado: {output_path}")
    print(f"   Sesiones: {session_num}")
    print(f"   Mensajes: {len(all_rows)}")


if __name__ == "__main__":
    main()
