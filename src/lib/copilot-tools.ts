import { tool } from "ai";
import { z } from "zod";
import { supabase } from "./supabaseClient";
import { searchConversations } from "./rag/qdrant-search";

export const copilotTools = {
  get_global_kpis: tool({
    description:
      "Métricas globales del período: tasa de resolución, churn risk, abandono y frustración promedio. Usá esta herramienta cuando el PM pregunta por números generales del canal o compara períodos.",
    inputSchema: z.object({}),
    execute: async () => {
      const { data: sessions } = await supabase.from("sessions").select("*");
      if (!sessions?.length) {
        return { error: "No hay sesiones en la base de datos." };
      }
      const total = sessions.length;
      const resolved = sessions.filter((s) => (s.resolution_rate ?? 0) >= 0.5).length;
      const avgFrust =
        sessions.reduce((a, s) => a + (s.avg_frustration_score ?? 0), 0) / total;
      return {
        total_sessions: total,
        resolution_rate_pct: Math.round((resolved / total) * 100),
        avg_frustration: Number(avgFrust.toFixed(2)),
        churn_rate_pct: Math.round(
          (sessions.filter((s) => s.is_churn_risk).length / total) * 100
        ),
        abandonment_rate_pct: Math.round(
          (sessions.filter((s) => s.has_abandonment).length / total) * 100
        ),
      };
    },
  }),

  get_intent_impact_matrix: tool({
    description:
      "Matriz de solicitudes de clientes con tasa de resolución, nivel de malestar, abandono e impacto en el negocio. Usá cuando el PM pregunta qué tipos de solicitudes tienen más fricción, cuáles priorizar o cuáles tienen peor experiencia.",
    inputSchema: z.object({
      limit: z.number().min(1).max(15).optional().describe("Máximo de intents"),
    }),
    execute: async ({ limit = 10 }) => {
      const { data: snapshots } = await supabase
        .from("metrics_snapshots")
        .select("metrics_json, period")
        .order("period", { ascending: false })
        .limit(1);

      const metrics = snapshots?.[0]?.metrics_json as Record<string, unknown> | undefined;
      const matrix =
        (metrics?.intent_matrix as Array<Record<string, unknown>>) ??
        (metrics?.business as { intent_matrix?: unknown })?.intent_matrix;

      if (Array.isArray(matrix) && matrix.length > 0) {
        return {
          period: snapshots?.[0]?.period,
          intents: matrix.slice(0, limit),
        };
      }

      const { data: sessions } = await supabase
        .from("sessions")
        .select("dominant_intent, resolution_rate, avg_frustration_score, has_abandonment");

      if (!sessions?.length) {
        return { error: "Sin datos de sesiones ni snapshot de métricas." };
      }

      const groups: Record<string, { n: number; res: number; frust: number; aban: number }> = {};
      sessions.forEach((s) => {
        const intent = s.dominant_intent || "otra";
        if (!groups[intent]) groups[intent] = { n: 0, res: 0, frust: 0, aban: 0 };
        groups[intent].n += 1;
        if ((s.resolution_rate ?? 0) >= 0.5) groups[intent].res += 1;
        groups[intent].frust += s.avg_frustration_score ?? 0;
        if (s.has_abandonment) groups[intent].aban += 1;
      });

      const intents = Object.entries(groups)
        .map(([intent_label, g]) => ({
          intent_label,
          session_count: g.n,
          irr: Math.round((g.res / g.n) * 1000) / 1000,
          unresolved_pct: Math.round((1 - g.res / g.n) * 1000) / 10,
          avg_frustration: Math.round((g.frust / g.n) * 1000) / 1000,
          abandonment_rate: Math.round((g.aban / g.n) * 1000) / 1000,
        }))
        .sort((a, b) => b.session_count - a.session_count)
        .slice(0, limit);

      return { period: "live", intents };
    },
  }),

  get_frustrated_sessions: tool({
    description:
      "Sesiones reales de clientes con alto malestar o riesgo de abandono. Usá cuando el PM pide ver casos concretos, explorar clientes frustrados o entender patrones de comportamiento individual.",
    inputSchema: z.object({
      intent: z.string().optional().describe("Filtrar por dominant_intent"),
      limit: z.number().min(1).max(20).optional(),
    }),
    execute: async ({ intent, limit = 10 }) => {
      let query = supabase
        .from("sessions")
        .select(
          "id, region, dominant_intent, avg_frustration_score, max_frustration_score, resolution_rate, has_abandonment, is_churn_risk"
        )
        .order("avg_frustration_score", { ascending: false })
        .limit(limit);

      if (intent) {
        query = query.eq("dominant_intent", intent);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };
      const sessions = (data ?? []).map((s) => ({
        ...s,
        session_id: s.id,
      }));
      return { sessions };
    },
  }),

  search_conversations: tool({
    description:
      "Búsqueda semántica RAG en mensajes reales de clientes (base vectorial Qdrant). Usá SIEMPRE que el PM pida ejemplos, frases de clientes, evidencia de un problema específico, o quiera saber qué dicen los clientes sobre un tema. Devuelve session_id, fragmento de texto y similitud.",
    inputSchema: z.object({
      query: z.string().describe("Pregunta o frase a buscar en conversaciones"),
      limit: z.number().min(1).max(10).optional(),
    }),
    execute: async ({ query, limit = 6 }) => {
      try {
        const hits = await searchConversations(query, limit);
        return {
          query,
          matches: hits.map((h) => ({
            session_id: h.session_id,
            turn_id: h.turn_id,
            text_preview: h.text_preview,
            region: h.region,
            intent_label: h.intent_label,
            similarity: h.similarity,
          })),
        };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "Búsqueda no disponible",
          hint: "Verifica Qdrant (docker compose) y COHERE_API_KEY",
        };
      }
    },
  }),

  get_priority_user_stories: tool({
    description: "Historias de usuario priorizadas del backlog con métricas de impacto. Usá cuando el PM pregunta qué tiene el equipo priorizado, cuáles son las historias críticas o quiere revisar el backlog actual.",
    inputSchema: z.object({
      priority: z.enum(["P1", "P2", "P3", "all"]).optional(),
    }),
    execute: async ({ priority = "all" }) => {
      let query = supabase
        .from("user_stories")
        .select("*")
        .order("period", { ascending: false });

      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };

      let stories = data ?? [];
      if (priority !== "all") {
        stories = stories.filter((s) => s.priority === priority);
      }
      stories.sort(
        (a, b) =>
          (b.current_avg_frustration ?? 0) - (a.current_avg_frustration ?? 0)
      );
      return { stories: stories.slice(0, 10) };
    },
  }),

  create_kanban_action: tool({
    description:
      "Crea una tarjeta de acción en el tablero Kanban del equipo de producto. Usá esta herramienta cuando el PM te pida crear, registrar o planificar una acción, tarea o mejora basada en el análisis. La tarjeta aparecerá automáticamente en la columna 'Detectado' del Plan de Acción.",
    inputSchema: z.object({
      title: z.string().describe("Título resumido de la acción"),
      description: z.string().describe("Descripción del problema y contexto"),
      severity: z
        .enum(["critical", "high", "medium", "low"])
        .describe("Nivel de severidad"),
      assignee: z
        .string()
        .optional()
        .describe("Equipo o persona responsable sugerida"),
      source_intent: z
        .string()
        .optional()
        .describe(
          "Intent relacionado si aplica, ej: cancelacion, consulta_saldo"
        ),
    }),
    execute: async ({ title, description, severity, assignee, source_intent }) => {
      try {
        const { data, error } = await supabase
          .from("action_items")
          .insert({
            title,
            description,
            source_type: "copilot",
            source_id: source_intent || null,
            severity,
            impact_score: 0.5,
            status: "detected",
            assignee: assignee || null,
            is_suggestion: false,
          })
          .select("id")
          .single();

        if (error) return { error: error.message };

        return {
          success: true,
          message: `Tarjeta "${title}" creada en el tablero. Asignada a: ${assignee || "Sin asignar"}. Severidad: ${severity}.`,
          action_id: data.id,
        };
      } catch (e) {
        return {
          error: e instanceof Error ? e.message : "Error al crear la tarjeta",
        };
      }
    },
  }),
};
