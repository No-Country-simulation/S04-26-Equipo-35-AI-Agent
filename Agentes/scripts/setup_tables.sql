-- ============================================================================
-- ConversaAI — Setup de tablas en Supabase
--
-- Ejecutar este script en el SQL Editor de Supabase:
--   https://supabase.com/dashboard → Tu proyecto → SQL Editor → New Query
--
-- Este script crea las tablas necesarias para el pipeline de agentes.
-- Es idempotente: se puede ejecutar múltiples veces sin errores.
-- ============================================================================

-- ── Tabla: sessions ─────────────────────────────────────────────────────────
-- Una fila por sesión de soporte. Agrupa todos los mensajes de un usuario.

CREATE TABLE IF NOT EXISTS sessions (
    id                    TEXT PRIMARY KEY,  -- ej: SESS-14614
    usuario               TEXT,              -- ej: @miniKittyLuna
    region                TEXT CHECK (region IN ('LATAM', 'BRAZIL', 'EUROPE')),
    total_turns           INTEGER DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT NOW(),

    -- Métricas agregadas (se llenan después del análisis por los agentes)
    avg_frustration_score REAL,
    max_frustration_score REAL,
    has_escalation        BOOLEAN DEFAULT FALSE,
    has_abandonment       BOOLEAN DEFAULT FALSE,
    dominant_intent       TEXT,
    resolution_rate       REAL,
    is_churn_risk         BOOLEAN DEFAULT FALSE
);

-- ── Tabla: messages ─────────────────────────────────────────────────────────
-- Cada mensaje/turno de la conversación.
-- NOTA: El CSV original tiene texto_espanol y texto_portugues como columnas
-- separadas (textos paralelos bilingües). Se almacenan ambos.

CREATE TABLE IF NOT EXISTS messages (
    id                  BIGSERIAL PRIMARY KEY,
    session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_id             INTEGER NOT NULL,
    fecha               TIMESTAMPTZ,         -- timestamp original del CSV
    region              TEXT,                 -- LATAM, BRAZIL, EUROPE

    -- Textos originales bilingües
    texto_espanol       TEXT,
    texto_portugues     TEXT,
    text_clean          TEXT,                -- Texto limpio (el que usó el ETL)

    -- Datos originales del CSV
    intencion_original  TEXT,                -- intencion del CSV (logistica_envio, problema_pago)
    nivel_frustracion   INTEGER CHECK (nivel_frustracion >= 0 AND nivel_frustracion <= 2),
    es_churn_risk       BOOLEAN DEFAULT FALSE,

    -- Sentiment Agent (campos calculados por el agente)
    sentiment_label     TEXT CHECK (sentiment_label IN ('frustrado', 'neutro', 'satisfecho')),
    sentiment_score     REAL CHECK (sentiment_score >= 0.0 AND sentiment_score <= 1.0),
    escalation          BOOLEAN DEFAULT FALSE,
    abandonment_risk    BOOLEAN DEFAULT FALSE,

    -- Intent Agent (campos calculados por el agente)
    intent_label        TEXT,                -- Intención reclasificada por el agente
    intent_confidence   REAL CHECK (intent_confidence >= 0.0 AND intent_confidence <= 1.0),
    resolved            BOOLEAN,

    -- Referencia a Qdrant (embedding vectorial)
    qdrant_point_id     TEXT,

    -- Constraint: un turno único por sesión
    UNIQUE (session_id, turn_id)
);

-- Índices para consultas frecuentes del dashboard
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON messages(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_messages_intent ON messages(intent_label);
CREATE INDEX IF NOT EXISTS idx_messages_intent_orig ON messages(intencion_original);
CREATE INDEX IF NOT EXISTS idx_messages_resolved ON messages(resolved);
CREATE INDEX IF NOT EXISTS idx_messages_region ON messages(region);
CREATE INDEX IF NOT EXISTS idx_messages_frustracion ON messages(nivel_frustracion);

-- ── Tabla: pipeline_runs ────────────────────────────────────────────────────
-- Auditoría de ejecuciones del pipeline.

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              BIGSERIAL PRIMARY KEY,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    corpus_file     TEXT DEFAULT '',
    total_messages  INTEGER DEFAULT 0,
    total_sessions  INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message   TEXT
);

-- ── Tabla: metrics_snapshots ────────────────────────────────────────────────
-- Snapshots mensuales de métricas para comparación histórica en el dashboard.

CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id           BIGSERIAL PRIMARY KEY,
    period       TEXT NOT NULL,  -- YYYY-MM
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    UNIQUE (period)
);

-- ── Tabla: user_stories ─────────────────────────────────────────────────────
-- User Stories generadas automáticamente por el Analyst Agent.
-- El dashboard las consume para el "Centro de Acción" (Action Hub).

CREATE TABLE IF NOT EXISTS user_stories (
    id                      BIGSERIAL PRIMARY KEY,
    story_id                TEXT NOT NULL,          -- US-001, US-002...
    period                  TEXT NOT NULL,           -- YYYY-MM
    priority                TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3')),
    severity                TEXT NOT NULL CHECK (severity IN ('crítico', 'alto', 'medio')),
    intent                  TEXT NOT NULL,
    title                   TEXT NOT NULL,
    user_story              TEXT NOT NULL,           -- "Como [rol], quiero [acción]..."
    acceptance_criteria     TEXT,                    -- Formato Gherkin
    success_metric          TEXT,
    affected_sessions       INTEGER DEFAULT 0,
    current_unresolved_pct  REAL DEFAULT 0,
    current_avg_frustration REAL DEFAULT 0,
    status                  TEXT DEFAULT 'backlog' CHECK (status IN ('backlog', 'in_progress', 'done', 'dismissed')),
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (story_id, period)
);

CREATE INDEX IF NOT EXISTS idx_user_stories_priority ON user_stories(priority);
CREATE INDEX IF NOT EXISTS idx_user_stories_period ON user_stories(period);
CREATE INDEX IF NOT EXISTS idx_user_stories_status ON user_stories(status);

-- ── Tabla: action_items ─────────────────────────────────────────────────────
-- Plan de acción del equipo de producto. Cada fila es una tarjeta del Kanban.

CREATE TABLE IF NOT EXISTS action_items (
    id              BIGSERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    source_type     TEXT DEFAULT 'manual',          -- 'intent' | 'flow' | 'manual'
    source_id       TEXT,                            -- intent key o flow id de origen
    severity        TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    impact_score    REAL DEFAULT 0,
    status          TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'analyzing', 'in_progress', 'resolved')),
    assignee        TEXT,
    notes           TEXT,
    is_suggestion   BOOLEAN DEFAULT FALSE,
    corpus_run_id   BIGINT REFERENCES pipeline_runs(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_items_status   ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_severity ON action_items(severity);
CREATE INDEX IF NOT EXISTS idx_action_items_source   ON action_items(source_type, source_id);

-- ── Row Level Security (RLS) ────────────────────────────────────────────────
-- Habilitar RLS pero permitir acceso con la service_role key.
-- Para producción, ajustar políticas según necesidad.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stories ENABLE ROW LEVEL SECURITY;

-- Política permisiva para service_role (los agentes Python usan service_role key)
-- DROP + CREATE porque PostgreSQL no soporta CREATE POLICY IF NOT EXISTS
DROP POLICY IF EXISTS "allow_all_sessions" ON sessions;
CREATE POLICY "allow_all_sessions" ON sessions FOR ALL USING (true);

DROP POLICY IF EXISTS "allow_all_messages" ON messages;
CREATE POLICY "allow_all_messages" ON messages FOR ALL USING (true);

DROP POLICY IF EXISTS "allow_all_pipeline_runs" ON pipeline_runs;
CREATE POLICY "allow_all_pipeline_runs" ON pipeline_runs FOR ALL USING (true);

DROP POLICY IF EXISTS "allow_all_metrics_snapshots" ON metrics_snapshots;
CREATE POLICY "allow_all_metrics_snapshots" ON metrics_snapshots FOR ALL USING (true);

DROP POLICY IF EXISTS "allow_all_user_stories" ON user_stories;
CREATE POLICY "allow_all_user_stories" ON user_stories FOR ALL USING (true);

ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_action_items" ON action_items;
CREATE POLICY "allow_all_action_items" ON action_items FOR ALL USING (true);

-- ============================================================================
-- ✅ Setup completado. Las tablas están listas para el pipeline.
--
-- Mapeo CSV → Tabla messages:
--   session_id       → session_id
--   usuario          → (en tabla sessions)
--   fecha            → fecha
--   region           → region
--   intencion        → intencion_original
--   nivel_frustracion → nivel_frustracion
--   texto_espanol    → texto_espanol
--   texto_portugues  → texto_portugues
--   es_churn_risk    → es_churn_risk
-- ============================================================================
