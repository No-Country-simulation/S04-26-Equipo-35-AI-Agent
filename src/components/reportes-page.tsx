"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { ArrowLeft, Download, SlidersHorizontal, X } from "lucide-react";
import { useTheme } from "../context/theme-context";
import { ReportBusinessSection } from "./report-business-section";
import type { GlobalKPIs, FlowTableItem, IntentTableItem } from "@src/lib/api";
import type { BusinessInsights } from "@src/lib/report-insights";

type ReportesPageProps = {
  kpis: GlobalKPIs;
  flows: FlowTableItem[];
  unresolvedIntents: IntentTableItem[];
  businessInsights: BusinessInsights | null;
};

// ─── Print styles injected at runtime ────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden; }
  #report-printable, #report-printable * { visibility: visible; }
  #report-printable { position: fixed; inset: 0; padding: 24px; background: #fff; }
  @page { margin: 1.5cm; }
}
`;

type Sections = { kpis: boolean; flows: boolean; intents: boolean; insights: boolean; recommendations: boolean };

// ─── PDF Preview Card ─────────────────────────────────────────────────────────
function PdfPreview({ kpis, flows, unresolvedIntents, sections }: ReportesPageProps & { sections: Sections }) {
  const today = new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });
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
          Reporte de análisis conversacional
        </h2>
        <p style={{ color: "#6B93A8", fontSize: 12, margin: 0 }}>
          ConversaAI · Generado automáticamente · {today}
        </p>
      </div>

      {/* PDF Body */}
      <div style={{ backgroundColor: "#FFFFFF", padding: 24, color: "#1D1C1A" }}>
        {/* Section 1 — Resumen ejecutivo */}
        {sections.kpis && <div style={{ marginBottom: 24 }}>
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
              { label: "Resolución", value: kpis.resolutionRate, delta: "Actual", deltaColor: "#888780" },
              { label: "Nivel de malestar", value: kpis.frustrationIndex, delta: "Actual", deltaColor: "#888780" },
              { label: "Sin resolver", value: kpis.unresolvedCount, delta: "Actual", deltaColor: "#888780" },
              { label: "Puntos de fricción", value: kpis.criticalFlows, delta: "Actual", deltaColor: "#888780" },
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
        </div>}

        {/* Section 2 — Top flujos */}
        {sections.flows && <div style={{ marginBottom: 24 }}>
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
            Puntos de contacto con mayor fricción
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
              <div style={{ color: "#888780", fontSize: 10 }}>Punto de contacto</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Fricción</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Abandono</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Volumen</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Prioridad</div>
            </div>
            {/* Rows */}
            {flows.slice(0, 4).map((row, i) => (
              <div
                key={i}
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                  padding: "8px 0",
                  borderBottom: i < 3 ? "0.5px solid #E8E6DE" : "none",
                }}
              >
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.name}</div>
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.frustration}%</div>
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.abandonment}%</div>
                <div style={{ color: "#888780", fontSize: 11 }}>{row.conversations}</div>
                <div>
                  <span
                    style={{
                      backgroundColor: row.severityBg,
                      color: row.severityColor,
                      fontSize: 9,
                      fontWeight: 500,
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "capitalize"
                    }}
                  >
                    {row.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* Section 3 — Intenciones sin resolver */}
        {sections.intents && <div style={{ marginBottom: 24 }}>
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
            Solicitudes sin atender — Top 5
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
              <div style={{ color: "#888780", fontSize: 10 }}>Solicitud del cliente</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Mensajes afectados</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Urgencia</div>
              <div style={{ color: "#888780", fontSize: 10 }}>Prioridad</div>
            </div>
            {/* Rows */}
            {unresolvedIntents.slice(0, 5).map((row, i) => (
              <div
                key={i}
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  padding: "8px 0",
                  borderBottom: i < (unresolvedIntents.slice(0, 5).length - 1) ? "0.5px solid #E8E6DE" : "none",
                }}
              >
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.name}</div>
                <div style={{ color: "#3D3B35", fontSize: 11 }}>{row.messages}</div>
                <div style={{ color: "#FF6B6B", fontSize: 11, fontWeight: 500 }}>{row.frustration}%</div>
                <div style={{ color: "#888780", fontSize: 10, textTransform: "capitalize" }}>{row.severity}</div>
              </div>
            ))}
          </div>
        </div>}

      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function ReportesPage(props: ReportesPageProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [sections, setSections] = useState<Sections>({ kpis: true, flows: true, intents: true, insights: true, recommendations: true });
  const [showCustomize, setShowCustomize] = useState(false);

  const toggleSection = (key: keyof Sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const sectionOpts: { key: keyof Sections; label: string }[] = [
    { key: "kpis", label: "Resumen ejecutivo (KPIs)" },
    { key: "flows", label: "Puntos de contacto con fricción" },
    { key: "intents", label: "Solicitudes sin atender" },
    { key: "insights", label: "Análisis del comportamiento del cliente" },
    { key: "recommendations", label: "Recomendaciones para producto" },
  ];

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Reportes" />} mainClassName="space-y-4">
      {/* Print CSS */}
      <style>{PRINT_STYLE}</style>

      {/* Breadcrumb + Back */}
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
          <Link href="/" style={{ color: colors.textSecondary, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
          <span style={{ color: colors.textPrimary }}>Reporte Dinámico</span>
        </nav>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 4, color: colors.textSecondary, fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "5px 12px", backgroundColor: "transparent", cursor: "pointer" }}>
          <ArrowLeft size={13} /> Volver
        </button>
      </div>

      {/* Page Header */}
      <div className="flex items-start justify-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
            Reporte de Análisis Conversacional
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: 12, margin: "4px 0 0 0" }}>
            Experiencia del cliente · fricción · solicitudes sin atender · oportunidades de mejora
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
          {/* Customize button + popover */}
          <button
            onClick={() => setShowCustomize((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, color: colors.textSecondary, fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "6px 14px", backgroundColor: "transparent", cursor: "pointer" }}
          >
            <SlidersHorizontal size={13} /> Personalizar
          </button>
          {showCustomize && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 16, minWidth: 240, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600 }}>Secciones del reporte</span>
                <button onClick={() => setShowCustomize(false)} style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted }}><X size={14} /></button>
              </div>
              {sectionOpts.map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", cursor: "pointer", borderBottom: `1px solid ${colors.border}` }}>
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={() => toggleSection(key)}
                    style={{ accentColor: colors.accent, width: 14, height: 14 }}
                  />
                  <span style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</span>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={() => window.print()}
            style={{ display: "flex", alignItems: "center", gap: 6, color: "#FFFFFF", fontSize: 12, border: "none", borderRadius: 6, padding: "6px 14px", backgroundColor: colors.accent, cursor: "pointer", fontWeight: 600 }}
          >
            <Download size={14} /> Descargar PDF
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div id="report-printable">
        {props.businessInsights && (sections.insights || sections.recommendations) && (
          <ReportBusinessSection
            insights={{
              ...props.businessInsights,
              recommendations: sections.recommendations ? props.businessInsights.recommendations : [],
              intentMatrix: sections.insights ? props.businessInsights.intentMatrix : [],
              breakpoints: sections.insights ? props.businessInsights.breakpoints : null,
              repeatIntent: sections.insights ? props.businessInsights.repeatIntent : null,
            }}
          />
        )}
        <PdfPreview {...props} sections={sections} />
      </div>
    </DashboardShell>
  );
}
