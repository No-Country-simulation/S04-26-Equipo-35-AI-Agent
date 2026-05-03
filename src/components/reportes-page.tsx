import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { ArrowLeft, Download } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── PDF Preview Card ─────────────────────────────────────────────────────────
function PdfPreview() {
  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        maxWidth: 640,
        margin: "0 auto",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* PDF Header */}
      <div style={{ backgroundColor: "#0A1628", padding: 24 }}>
        <h2 style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 6 }}>
          Reporte de análisis conversacional · Abril 2025
        </h2>
        <p style={{ color: "#6B93A8", fontSize: 12, margin: 0 }}>
          ConversaAI · Generado el 30 abr 2025 · 2.13M mensajes procesados
        </p>
      </div>

      {/* PDF Body */}
      <div style={{ backgroundColor: "#FFFFFF", padding: 24, color: "#1D1C1A" }}>
        {/* Section 1 — Resumen ejecutivo */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              color: "#888780",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingBottom: 8,
              borderBottom: "0.5px solid #E8E6DE",
              marginBottom: 12,
            }}
          >
            Resumen ejecutivo
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Resolución", value: "64%", delta: "▼ 3% vs mar", deltaColor: "#FF6B6B" },
              { label: "Frustración", value: "31%", delta: "▲ 5% vs mar", deltaColor: "#FF6B6B" },
              { label: "Sin resolver", value: "18", delta: "▲ 2 nuevas", deltaColor: "#FF6B6B" },
              { label: "Flujos críticos", value: "4", delta: "sin cambio", deltaColor: "#888780" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                style={{
                  border: "0.5px solid #E8E6DE",
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <div style={{ color: "#888780", fontSize: 10, marginBottom: 4 }}>
                  {kpi.label}
                </div>
                <div style={{ color: "#1D1C1A", fontSize: 20, fontWeight: 600, marginBottom: 3 }}>
                  {kpi.value}
                </div>
                <div style={{ color: kpi.deltaColor, fontSize: 10 }}>{kpi.delta}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 — Top flujos */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              color: "#888780",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingBottom: 8,
              borderBottom: "0.5px solid #E8E6DE",
              marginBottom: 12,
            }}
          >
            Top flujos con mayor frustración
          </div>
          <div>
            {/* Header */}
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                padding: "6px 0",
                borderBottom: "0.5px solid #E8E6DE",
              }}
            >
              <div style={{ color: "#888780", fontSize: 10 }}>Flujo</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Frustración</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Abandono</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Variación</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Prioridad</div>
            </div>
            {/* Rows */}
            {[
              { flow: "Devoluciones", frust: "82%", aband: "47%", var: "▲ 12%", varColor: "#FF6B6B", priority: "crítico", prioColor: "#FF6B6B", prioBg: "#FEE" },
              { flow: "Cambio de plan", frust: "71%", aband: "39%", var: "▲ 8%", varColor: "#FF6B6B", priority: "crítico", prioColor: "#FF6B6B", prioBg: "#FEE" },
              { flow: "Soporte técnico", frust: "58%", aband: "31%", var: "▲ 4%", varColor: "#FF6B6B", priority: "medio", prioColor: "#F5A623", prioBg: "#FEF5E7" },
              { flow: "Facturación", frust: "44%", aband: "22%", var: "=", varColor: "#888780", priority: "medio", prioColor: "#F5A623", prioBg: "#FEF5E7" },
            ].map((row, i) => (
              <div
                key={i}
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  padding: "8px 0",
                  borderBottom: i < 3 ? "0.5px solid #E8E6DE" : "none",
                }}
              >
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.flow}</div>
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.frust}</div>
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.aband}</div>
                <div style={{ color: row.varColor, fontSize: 11 }}>{row.var}</div>
                <div>
                  <span
                    style={{
                      backgroundColor: row.prioBg,
                      color: row.prioColor,
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {row.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3 — Intenciones sin resolver */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              color: "#888780",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingBottom: 8,
              borderBottom: "0.5px solid #E8E6DE",
              marginBottom: 12,
            }}
          >
            Intenciones sin resolver — Top 5
          </div>
          <div>
            {/* Header */}
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                padding: "6px 0",
                borderBottom: "0.5px solid #E8E6DE",
              }}
            >
              <div style={{ color: "#888780", fontSize: 10 }}>Intención</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Mensajes afectados</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Frustración asociada</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Idiomas</div>
            </div>
            {/* Rows */}
            {[
              { intent: "Cancelar suscripción", msgs: "4.2k", frust: "88%", frustColor: "#FF6B6B", langs: "ES · PT" },
              { intent: "Reembolso parcial", msgs: "2.8k", frust: "79%", frustColor: "#FF6B6B", langs: "ES · PT" },
              { intent: "Portabilidad de datos", msgs: "1.1k", frust: "61%", frustColor: "#F5A623", langs: "ES" },
              { intent: "Error de pago recurrente", msgs: "980", frust: "57%", frustColor: "#F5A623", langs: "PT" },
              { intent: "Cambio de titular", msgs: "540", frust: "34%", frustColor: "#888780", langs: "ES" },
            ].map((row, i) => (
              <div
                key={i}
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "8px 0",
                  borderBottom: i < 4 ? "0.5px solid #E8E6DE" : "none",
                }}
              >
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.intent}</div>
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.msgs}</div>
                <div style={{ color: row.frustColor, fontSize: 11, fontWeight: 500 }}>{row.frust}</div>
                <div style={{ color: "#888780", fontSize: 10 }}>{row.langs}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4 — Recomendaciones */}
        <div>
          <div
            style={{
              color: "#888780",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingBottom: 8,
              borderBottom: "0.5px solid #E8E6DE",
              marginBottom: 12,
            }}
          >
            Recomendaciones accionables para el sprint
          </div>
          <div className="space-y-4">
            {[
              {
                num: "1",
                title: "Agregar intención cancelar_suscripcion y configurar handoff",
                body: "Entrenar el modelo con ejemplos de cancelación y configurar handoff a agente humano cuando se detecte. Esto reducirá la frustración del usuario al ser atendido correctamente.",
                impact: "4.2k conversaciones mensuales con 0% de resolución actual",
              },
              {
                num: "2",
                title: "Rediseñar paso 3 del flujo de Devoluciones (verificación)",
                body: "El paso de verificación está causando el 81% de frustración. Simplificar validación de datos y permitir múltiples formatos de número de orden para reducir ciclos.",
                impact: "12.4k conversaciones mensuales con abandono del 47%",
              },
              {
                num: "3",
                title: "Revisar corpus PT para reentrenar modelo de sentimiento",
                body: "El F1 de sentimiento en PT bajó 6.2% (de 0.824 a 0.762) superando el umbral de degradación del 5%. Analizar cambios en el lenguaje del usuario y reentrenar.",
                impact: "734k mensajes mensuales en portugués con detección degradada",
              },
            ].map((rec) => (
              <div key={rec.num} className="flex gap-3">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "#EEEDFE",
                    color: "#3C3489",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {rec.num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#1D1C1A", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    {rec.title}
                  </div>
                  <div style={{ color: "#5F5E5A", fontSize: 11, lineHeight: 1.5, marginBottom: 4 }}>
                    {rec.body}
                  </div>
                  <div style={{ color: "#0F6E56", fontSize: 11, fontWeight: 600 }}>
                    Impacto estimado: {rec.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function ReportesPage() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Reportes" />} mainClassName="space-y-4">
          {/* Breadcrumb + Back */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
              <Link
                href="/"
                style={{ color: colors.textSecondary, textDecoration: "none" }}
                className="hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
              <span style={{ color: colors.textPrimary }}>Reporte mensual</span>
            </nav>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 transition-colors"
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: "5px 12px",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary;
                (e.currentTarget as HTMLButtonElement).style.borderColor = colors.textSecondary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
                (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
              }}
            >
              <ArrowLeft size={13} />
              Volver
            </button>
          </div>

          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
                Reporte mensual — Abril 2025
              </h1>
              <p style={{ color: colors.textSecondary, fontSize: 12, margin: "4px 0 0 0" }}>
                Vista previa antes de exportar
              </p>
            </div>
            <div className="flex gap-2">
              <button
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  border: `1px solid ${colors.textSecondary}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                }}
              >
                Personalizar secciones
              </button>
              <button
                className="flex items-center gap-2"
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  backgroundColor: colors.accent,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <Download size={14} />
                Descargar PDF
              </button>
            </div>
          </div>

          {/* PDF Preview */}
          <PdfPreview />
    </DashboardShell>
  );
}
