export type Severity = "critical" | "high" | "medium" | "low";
export type Status = "detected" | "analyzing" | "in_progress" | "resolved";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  source_type: string;
  source_id: string | null;
  severity: Severity;
  impact_score: number;
  status: Status;
  assignee: string | null;
  notes: string | null;
  is_suggestion: boolean;
  corpus_run_id: number | null;
  created_at: string;
  updated_at: string;
}

type SeedBase = Omit<ActionItem, "id" | "created_at" | "updated_at">;

const SEED_BASES: SeedBase[] = [
  {
    title: "Resolver flujo de facturación frustrado",
    description: "Alta concentración de abandonos en el paso 3 del flujo de facturación.",
    source_type: "flow", source_id: "facturación",
    severity: "critical", impact_score: 0.92,
    status: "detected", assignee: null, notes: null,
    is_suggestion: false, corpus_run_id: null,
  },
  {
    title: "Mejorar tasa de resolución en consultas de saldo",
    description: "El 71% de las conversaciones sobre saldo terminan sin resolución.",
    source_type: "intent", source_id: "consulta_saldo",
    severity: "high", impact_score: 0.74,
    status: "in_progress", assignee: "Ana García", notes: null,
    is_suggestion: false, corpus_run_id: null,
  },
  {
    title: "Reducir loops de confirmación de identidad",
    description: "Los clientes quedan atrapados en bucles de verificación.",
    source_type: "flow", source_id: "verificacion_identidad",
    severity: "high", impact_score: 0.68,
    status: "analyzing", assignee: "Carlos López", notes: null,
    is_suggestion: false, corpus_run_id: null,
  },
  {
    title: "Añadir respuesta para cancelación de servicio",
    description: "Sin flujo de retención — los clientes abandonan sin alternativas.",
    source_type: "intent", source_id: "cancelacion_servicio",
    severity: "medium", impact_score: 0.51,
    status: "detected", assignee: null, notes: null,
    is_suggestion: false, corpus_run_id: null,
  },
  {
    title: "Optimizar tiempo de respuesta nocturno",
    description: "El SLA nocturno supera los 3 minutos. 38% de abandono.",
    source_type: "manual", source_id: null,
    severity: "medium", impact_score: 0.39,
    status: "resolved", assignee: "Laura Martínez", notes: "Implementado turno nocturno automatizado.",
    is_suggestion: false, corpus_run_id: null,
  },
];

export function buildSeedItems(): ActionItem[] {
  const now = new Date().toISOString();
  return SEED_BASES.map((s, i) => ({
    ...s,
    id: `seed-${i}`,
    created_at: now,
    updated_at: now,
  }));
}

export const ACCIONES_UPDATED_EVENT = "acciones-updated";

export function dispatchAccionesUpdate(items: ActionItem[]) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACCIONES_UPDATED_EVENT, { detail: { items } })
    );
  }
}

export function dispatchAccionesRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACCIONES_UPDATED_EVENT, { detail: { refresh: true } })
    );
  }
}
