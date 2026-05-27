"""
Generador de corpus sintético de demo para ConversaAI.

Genera un CSV con el formato REAL del pipeline:
  session_id, usuario, fecha, region, intencion,
  nivel_frustracion, texto_espanol, texto_portugues, es_churn_risk

Por defecto genera ~2 000 mensajes (~500 sesiones × 4 turnos prom.).
Suficiente para métricas completas en ~40 min con Groq free tier.

Uso:
  python scripts/generate_demo_corpus.py             # ~2 000 msgs
  python scripts/generate_demo_corpus.py --size 500  # demo rápido
  python scripts/generate_demo_corpus.py --size 2000 --out data/raw/demo_corpus.csv
"""
from __future__ import annotations

import argparse
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

# ── Regiones ─────────────────────────────────────────────────────────────────

REGIONS = ["LATAM", "LATAM", "LATAM", "BRAZIL"]

USERS_ES = [
    "carlos_m", "ana_garcia", "pedro_lopez", "lucia_ramos", "juan_diaz",
    "maria_torres", "roberto_v", "sofia_h", "diego_p", "valentina_r",
    "miguel_a", "camila_s", "andres_b", "paula_c", "fernando_g",
]

USERS_PT = [
    "joao_silva", "maria_costa", "pedro_oliveira", "ana_santos", "lucas_f",
    "juliana_p", "carlos_r", "beatriz_m", "rafael_n", "leticia_a",
]

# ── Textos en español por intención ─────────────────────────────────────────

TEXT_ES: dict[str, dict[str, list[str]]] = {
    "consulta_saldo": {
        "user": [
            "quiero saber mi saldo",
            "cuánto debo este mes",
            "cuál es mi saldo actual",
            "me pueden decir cuánto tengo pendiente",
            "necesito ver mi balance de cuenta",
        ],
        "resolved": [
            "Tu saldo es $150.00. Listo, ¿algo más?",
            "Tu saldo actual es de $234.56. Resuelto.",
            "El balance de tu cuenta es $89.00. Confirmado.",
        ],
        "unresolved": [
            "¿Puedes darme tu número de cuenta?",
            "Necesito verificar tu identidad primero.",
            "Un momento, estoy consultando el sistema.",
        ],
    },
    "reporte_problema": {
        "user": [
            "no funciona la aplicación",
            "la app no carga desde hace 3 días",
            "no puedo entrar a mi cuenta",
            "da error al iniciar sesión",
            "la página se queda en blanco",
        ],
        "resolved": [
            "Ya identificamos el problema, se solucionó. Listo.",
            "Hemos reiniciado tu sesión. TICKET-{t} abierto. Resuelto.",
            "El error fue corregido, ya puedes ingresar. Confirmado.",
        ],
        "unresolved": [
            "¿Probó reiniciar la aplicación?",
            "Entiendo, voy a revisar el sistema.",
            "¿Puede describir el error con más detalle?",
        ],
    },
    "solicitud_reembolso": {
        "user": [
            "me cobraron de más, quiero reembolso",
            "quiero mi dinero de vuelta",
            "hay un cargo que no reconozco",
            "me cobraron doble",
            "necesito que devuelvan el cobro erróneo",
        ],
        "resolved": [
            "Reembolso procesado por $50.00. TICKET-{t} generado. Listo.",
            "Ya se aplicó la devolución a tu cuenta. Confirmado.",
            "El cargo fue revertido exitosamente. Resuelto.",
        ],
        "unresolved": [
            "Necesito el número de referencia del cobro.",
            "Voy a escalar esto al área de finanzas.",
            "¿Puede enviar captura del cargo no reconocido?",
        ],
    },
    "cambio_datos": {
        "user": [
            "quiero cambiar mi teléfono de contacto",
            "necesito actualizar mi correo electrónico",
            "cambiar dirección de facturación",
            "actualizar mis datos personales",
        ],
        "resolved": [
            "Datos actualizados correctamente. Listo.",
            "Tu teléfono fue cambiado sin problemas. Confirmado.",
            "Correo actualizado exitosamente. Resuelto.",
        ],
        "unresolved": [
            "¿Cuál es el nuevo dato a actualizar?",
            "Necesito verificar tu identidad primero.",
            "¿Me puede dar su nombre completo para continuar?",
        ],
    },
    "consulta_estado": {
        "user": [
            "dónde está mi pedido",
            "cuál es el estado de mi reclamo",
            "qué pasó con mi ticket abierto",
            "hace 5 días hice un pedido y no llega",
        ],
        "resolved": [
            "Tu pedido llega mañana. Seguimiento: TR-{t}. Listo.",
            "Tu reclamo fue procesado. CASO-{t} asignado. Resuelto.",
            "El ticket fue resuelto ayer. Confirmado.",
        ],
        "unresolved": [
            "¿Tiene el número de pedido o reclamo?",
            "Estoy verificando en el sistema, un momento.",
            "No encuentro ese pedido, ¿puede verificar el número?",
        ],
    },
    "queja_servicio": {
        "user": [
            "el servicio es pésimo",
            "quiero hablar con un humano ahora",
            "estoy harto de este chatbot que no ayuda",
            "qué mal servicio, esto no debería ser así",
            "llevo horas esperando respuesta y nada",
        ],
        "resolved": [
            "Lamento la experiencia. Te transfiero a un agente humano. Listo.",
            "Entiendo tu frustración. Escalé tu caso con prioridad. TICKET-{t}.",
        ],
        "unresolved": [
            "Entiendo, ¿puedo ayudarte con algo específico?",
            "Lamento el inconveniente causado.",
            "¿Puede ser más específico con el problema que tuvo?",
        ],
    },
    "solicitud_info": {
        "user": [
            "cómo funciona el plan premium",
            "qué incluye la suscripción mensual",
            "cuáles son los horarios de atención al cliente",
            "necesito información sobre los planes disponibles",
        ],
        "resolved": [
            "El plan premium incluye acceso ilimitado, soporte 24/7 y más. Listo.",
            "Nuestro horario de atención es de 8 a 20h de lunes a viernes. Resuelto.",
            "Aquí está la información completa: https://example.com/planes. Confirmado.",
        ],
        "unresolved": [
            "¿Qué plan le interesa en particular?",
            "Un momento, estoy buscando esa información.",
            "¿Puede ser más específico sobre lo que necesita saber?",
        ],
    },
    "cancelacion": {
        "user": [
            "quiero cancelar mi suscripción",
            "dar de baja mi cuenta definitivamente",
            "cancelar el servicio que contraté",
            "no quiero seguir con este plan",
        ],
        "resolved": [
            "Cancelación procesada. Lamentamos que te vayas. Listo.",
            "Tu suscripción fue cancelada exitosamente. Confirmado.",
        ],
        "unresolved": [
            "¿Estás seguro? Tenemos una oferta especial para retenerte.",
            "¿Puedo saber el motivo de la cancelación?",
            "Antes de cancelar, ¿puedo ofrecerte un descuento del 30%?",
        ],
    },
    "logistica_envio": {
        "user": [
            "mi paquete no llegó en la fecha indicada",
            "el repartidor no pasó por mi domicilio",
            "el envío lleva 5 días de retraso",
            "dónde está mi paquete, ya pasó la fecha de entrega",
            "el courier no me encontró y no dejó ningún aviso",
        ],
        "resolved": [
            "Reprogramamos la entrega para mañana. TICKET-{t} generado. Listo.",
            "El paquete fue reagendado con el courier. Resuelto.",
        ],
        "unresolved": [
            "¿Tiene el número de seguimiento del envío?",
            "Estoy consultando con el courier asignado.",
            "El sistema muestra que fue entregado, ¿revisó con vecinos?",
        ],
    },
    "problema_pago": {
        "user": [
            "me cobraron dos veces el mismo concepto",
            "hay un cargo duplicado en mi tarjeta de crédito",
            "el pago no se procesó pero me descontaron el dinero",
            "pagué pero el sistema dice que tengo deuda pendiente",
            "no reconozco este cobro reciente en mi cuenta",
        ],
        "resolved": [
            "El cargo duplicado fue revertido. TICKET-{t}. Listo.",
            "Confirmamos tu pago. El sistema fue actualizado. Resuelto.",
        ],
        "unresolved": [
            "¿Puede enviar captura del estado de cuenta?",
            "Necesito el número de referencia de la transacción.",
            "Voy a escalar este caso al área de pagos.",
        ],
    },
}

# ── Textos en portugués (subconjunto para BRAZIL) ────────────────────────────

TEXT_PT: dict[str, dict[str, list[str]]] = {
    "consulta_saldo": {
        "user": [
            "quero saber meu saldo",
            "quanto devo este mês",
            "qual é meu saldo atual",
            "preciso ver meu balanço de conta",
        ],
        "resolved": [
            "Seu saldo é R$150.00. Pronto, algo mais?",
            "O saldo da sua conta é R$234.56. Feito.",
        ],
        "unresolved": [
            "Pode me dar seu número de conta?",
            "Preciso verificar sua identidade primeiro.",
        ],
    },
    "reporte_problema": {
        "user": [
            "o app não funciona de jeito nenhum",
            "não consigo entrar na minha conta",
            "dá erro ao fazer login há 3 dias",
            "a página fica em branco",
        ],
        "resolved": [
            "Já identificamos o problema, foi solucionado. Pronto.",
            "Reiniciamos sua sessão. TICKET-{t} aberto. Resolvido.",
        ],
        "unresolved": [
            "Tentou reiniciar o aplicativo?",
            "Entendo, vou verificar no sistema.",
        ],
    },
    "solicitud_reembolso": {
        "user": [
            "cobraram errado, quero reembolso",
            "quero meu dinheiro de volta",
            "tem uma cobrança que não reconheço",
            "cobraram duas vezes o mesmo valor",
        ],
        "resolved": [
            "Reembolso processado. TICKET-{t} gerado. Pronto.",
            "A devolução foi aplicada à sua conta. Feito.",
        ],
        "unresolved": [
            "Preciso do número de referência da cobrança.",
            "Vou escalar para a área financeira.",
        ],
    },
    "queja_servicio": {
        "user": [
            "péssimo atendimento, não resolve nada",
            "quero falar com um humano agora",
            "que absurdo, ninguém me ajuda",
            "já faz horas que espero uma resposta",
        ],
        "resolved": [
            "Lamento a experiência. Vou transferir para um atendente. Pronto.",
        ],
        "unresolved": [
            "Entendo, posso ajudar com algo mais específico?",
            "Lamento o inconveniente causado.",
        ],
    },
    "cancelacion": {
        "user": [
            "quero cancelar minha assinatura",
            "cancelar o serviço contratado",
            "não quero mais esse plano",
        ],
        "resolved": [
            "Cancelamento processado com sucesso. Feito.",
        ],
        "unresolved": [
            "Tem certeza? Temos uma oferta especial para você.",
            "Posso saber o motivo do cancelamento?",
        ],
    },
    "logistica_envio": {
        "user": [
            "meu pacote não chegou na data prevista",
            "o entregador não passou pela minha casa",
            "o envio está 5 dias atrasado",
            "onde está meu pedido, já passou da data",
        ],
        "resolved": [
            "Reagendamos a entrega para amanhã. TICKET-{t}. Pronto.",
        ],
        "unresolved": [
            "Tem o número de rastreamento do envio?",
            "Estou consultando com a transportadora.",
        ],
    },
    "problema_pago": {
        "user": [
            "cobraram duas vezes o mesmo valor",
            "há uma cobrança duplicada no meu cartão",
            "paguei mas o sistema diz que tenho dívida",
        ],
        "resolved": [
            "A cobrança duplicada foi estornada. TICKET-{t}. Pronto.",
        ],
        "unresolved": [
            "Pode enviar print do extrato bancário?",
            "Preciso do número de referência da transação.",
        ],
    },
}

# ── Frases de escalada ────────────────────────────────────────────────────────

ESCALATION_ES = [
    "ya les dije, no funciona y nadie resuelve",
    "CUÁNTAS VECES TENGO QUE REPETIR LO MISMO",
    "esto es un robo, exijo mi dinero 😤😡",
    "PÉSIMO SERVICIO, NO SIRVEN PARA NADA 🤬",
    "llevo 3 días esperando y absolutamente nada!!!",
    "no me entienden, qué mal servicio tienen",
    "ya chole, quiero hablar con un humano YA",
    "voy a poner una queja formal, es inaceptable",
]

ESCALATION_PT = [
    "já falei várias vezes, não funciona",
    "QUE ABSURDO, NINGUÉM RESOLVE NADA AQUI",
    "péssimo atendimento 😤😡",
    "HORRÍVEL, NÃO SERVEM PARA NADA 🤬",
    "já faz 3 dias e absolutamente nada!!!",
    "vocês me enganaram, isso é fraude",
    "vou registrar uma reclamação formal",
]

# ── Tipos de sesión y su distribución ────────────────────────────────────────

SESSION_TYPES = {
    "satisfecha": 0.30,
    "neutra": 0.25,
    "frustrada_resuelta": 0.18,
    "frustrada_escalada": 0.14,
    "abandono": 0.08,
    "multi_intent": 0.05,
}


def _ts(base: datetime, turn: int) -> str:
    delta = timedelta(seconds=turn * random.randint(25, 100))
    return (base + delta).strftime("%Y-%m-%d %H:%M:%S")


def _nivel(session_type: str, turn_index: int, total_turns: int) -> int:
    if session_type in ("frustrada_escalada", "abandono"):
        if turn_index >= total_turns // 2:
            return 2
        return 1
    if session_type == "frustrada_resuelta":
        return 1
    if session_type == "satisfecha":
        return 0
    return random.choice([0, 0, 1])


def _churn(session_type: str) -> bool:
    return session_type in ("frustrada_escalada", "abandono") and random.random() < 0.7


def generate_session(
    session_num: int,
    session_type: str,
    region: str,
    base_time: datetime,
) -> list[dict]:
    lang = "pt" if region == "BRAZIL" else "es"
    texts = TEXT_ES if lang == "es" else TEXT_PT
    escalation = ESCALATION_ES if lang == "es" else ESCALATION_PT
    users = USERS_PT if region == "BRAZIL" else USERS_ES

    session_id = f"SES-{session_num:05d}"
    usuario = random.choice(users)
    intent_key = random.choice(list(texts.keys()))
    idata = texts[intent_key]

    rows: list[dict] = []

    def msg(turn: int, text_es: str, text_pt: str, intent: str, nivel: int, churn: bool) -> dict:
        return {
            "session_id": session_id,
            "usuario": usuario,
            "fecha": _ts(base_time, turn),
            "region": region,
            "intencion": intent,
            "nivel_frustracion": nivel,
            "texto_espanol": text_es,
            "texto_portugues": text_pt,
            "es_churn_risk": churn,
        }

    def bilingual(es_pool: list[str], pt_pool: list[str]) -> tuple[str, str]:
        es = random.choice(es_pool)
        pt = random.choice(pt_pool) if pt_pool else ""
        return es, pt

    def ticket() -> str:
        return str(random.randint(10000, 99999))

    # Texto usuario en ambos idiomas (para todas las regiones)
    user_es = TEXT_ES.get(intent_key, TEXT_ES["reporte_problema"])["user"]
    user_pt_src = TEXT_PT.get(intent_key, {}).get("user", user_es)
    res_es = TEXT_ES.get(intent_key, TEXT_ES["reporte_problema"])["resolved"]
    unres_es = TEXT_ES.get(intent_key, TEXT_ES["reporte_problema"])["unresolved"]
    res_pt = TEXT_PT.get(intent_key, {}).get("resolved", res_es)
    unres_pt = TEXT_PT.get(intent_key, {}).get("unresolved", unres_es)
    esc_es = random.choice(ESCALATION_ES)
    esc_pt = random.choice(ESCALATION_PT)

    if session_type == "satisfecha":
        turn_texts = [
            (random.choice(user_es), random.choice(user_pt_src), 0),
            (random.choice(res_es).replace("{t}", ticket()), random.choice(res_pt).replace("{t}", ticket()), 0),
            ("gracias, perfecto, quedé muy satisfecho", "obrigado, perfeito, fiquei satisfeito", 0),
        ]
        is_churn = False

    elif session_type == "neutra":
        turn_texts = [
            (random.choice(user_es), random.choice(user_pt_src), 0),
            (random.choice(unres_es), random.choice(unres_pt), 0),
            ("mi número es 12345678", "meu número é 12345678", 0),
            (random.choice(res_es).replace("{t}", ticket()), random.choice(res_pt).replace("{t}", ticket()), 0),
        ]
        is_churn = False

    elif session_type == "frustrada_resuelta":
        turn_texts = [
            (random.choice(user_es), random.choice(user_pt_src), 0),
            (random.choice(unres_es), random.choice(unres_pt), 1),
            ("no me entiende, ya les dije esto antes", "vocês não entendem, já falei isso", 1),
            (random.choice(res_es).replace("{t}", ticket()), random.choice(res_pt).replace("{t}", ticket()), 1),
            ("ok gracias, al final se resolvió", "ok obrigado, finalmente resolvido", 0),
        ]
        is_churn = False

    elif session_type == "frustrada_escalada":
        turn_texts = [
            (random.choice(user_es), random.choice(user_pt_src), 0),
            (random.choice(unres_es), random.choice(unres_pt), 1),
            (random.choice(user_es), random.choice(user_pt_src), 1),
            (random.choice(unres_es), random.choice(unres_pt), 1),
            (esc_es, esc_pt, 2),
            (random.choice(unres_es), random.choice(unres_pt), 2),
            (random.choice(ESCALATION_ES), random.choice(ESCALATION_PT), 2),
        ]
        is_churn = random.random() < 0.7

    elif session_type == "abandono":
        turn_texts = [
            (random.choice(user_es), random.choice(user_pt_src), 0),
            (random.choice(unres_es), random.choice(unres_pt), 1),
            (esc_es, esc_pt, 2),
            (random.choice(unres_es), random.choice(unres_pt), 2),
        ]
        is_churn = True

    elif session_type == "multi_intent":
        intents_to_use = random.sample(list(TEXT_ES.keys()), min(3, len(TEXT_ES)))
        turn_texts = []
        for ik in intents_to_use:
            u_es = random.choice(TEXT_ES[ik]["user"])
            u_pt = random.choice(TEXT_PT.get(ik, {}).get("user", [u_es]))
            turn_texts.append((u_es, u_pt, 0))
            resolved = random.random() > 0.4
            if resolved:
                b_es = random.choice(TEXT_ES[ik]["resolved"]).replace("{t}", ticket())
                b_pt = random.choice(TEXT_PT.get(ik, {}).get("resolved", [b_es])).replace("{t}", ticket())
            else:
                b_es = random.choice(TEXT_ES[ik]["unresolved"])
                b_pt = random.choice(TEXT_PT.get(ik, {}).get("unresolved", [b_es]))
            turn_texts.append((b_es, b_pt, 0))
        is_churn = False
    else:
        turn_texts = [(random.choice(user_es), random.choice(user_pt_src), 0)]
        is_churn = False

    for turn_i, (t_es, t_pt, nivel) in enumerate(turn_texts):
        rows.append(msg(turn_i, t_es, t_pt, intent_key, nivel, is_churn))

    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Generar corpus demo en formato real")
    parser.add_argument(
        "--size", type=int, default=2000,
        help="Número aproximado de mensajes a generar (default: 2000)",
    )
    parser.add_argument(
        "--out", type=str, default="data/raw/demo_corpus.csv",
        help="Ruta de salida del CSV",
    )
    args = parser.parse_args()

    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # ~4 turnos por sesión en promedio → sessions = size / 4
    target_sessions = max(50, args.size // 4)

    all_rows: list[dict] = []
    session_num = 0
    base_date = datetime(2025, 4, 1, 8, 0, 0)

    for session_type, pct in SESSION_TYPES.items():
        count = max(1, int(target_sessions * pct))
        for _ in range(count):
            session_num += 1
            region = random.choice(REGIONS)
            day_offset = random.randint(0, 59)
            hour_offset = random.randint(0, 14)
            session_time = base_date + timedelta(days=day_offset, hours=hour_offset)
            rows = generate_session(session_num, session_type, region, session_time)
            all_rows.extend(rows)

    FIELDNAMES = [
        "session_id", "usuario", "fecha", "region", "intencion",
        "nivel_frustracion", "texto_espanol", "texto_portugues", "es_churn_risk",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_rows)

    sessions = len({r["session_id"] for r in all_rows})
    regions_count = {}
    for r in all_rows:
        regions_count[r["region"]] = regions_count.get(r["region"], 0) + 1

    print(f"Corpus generado: {output_path}")
    print(f"  Mensajes  : {len(all_rows)}")
    print(f"  Sesiones  : {sessions}")
    print(f"  Por region: {regions_count}")
    intents_count: dict[str, int] = {}
    for r in all_rows:
        intents_count[r["intencion"]] = intents_count.get(r["intencion"], 0) + 1
    for k, v in sorted(intents_count.items(), key=lambda x: -x[1]):
        print(f"    {k}: {v}")


if __name__ == "__main__":
    main()
