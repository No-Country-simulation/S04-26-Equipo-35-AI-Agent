"use client";
import { usePathname } from "next/navigation";
import { useTheme } from "../context/theme-context";

const PAGE_TITLES: Record<string, { label: string; description: string }> = {
  "/": { label: "Resumen", description: "Vista ejecutiva del estado del producto" },
  "/frustracion": { label: "Frustración", description: "Dónde pierden confianza tus clientes" },
  "/intenciones": { label: "Solicitudes", description: "Solicitudes del cliente sin resolver" },
  "/acciones": { label: "Acciones", description: "Plan de trabajo del equipo" },
  "/reportes": { label: "Reportes", description: "Exportar análisis" },
  "/corpus/cargar": { label: "Pipeline datos", description: "Ingesta y procesamiento de corpus" },
  "/metricas-modelo": { label: "Métricas modelo", description: "Calidad del análisis" },
  "/historial": { label: "Historial", description: "Runs anteriores" },
  "/flujos": { label: "Flujos", description: "Flujos conversacionales" },
};

export function TopNav() {
  const pathname = usePathname();
  const { colors } = useTheme();

  const page = PAGE_TITLES[pathname] ?? { label: "ConversaAI", description: "" };

  return (
    <header
      className="flex shrink-0 items-center justify-between px-6 h-14 border-b"
      style={{
        background: `${colors.navbar}cc`,
        backdropFilter: "blur(16px)",
        borderColor: colors.border,
        zIndex: 50,
      }}
    >
      <div className="flex items-center gap-3">
        <div>
          <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {page.label}
          </span>
          {page.description && (
            <span style={{ color: colors.textMuted, fontSize: 12, marginLeft: 10 }}>
              {page.description}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md"
          style={{ background: colors.card, border: `1px solid ${colors.border}` }}
        >
          <div style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: colors.success,
            boxShadow: `0 0 6px ${colors.success}`,
          }} />
          <span style={{ fontSize: 11.5, color: colors.textSecondary }}>Sistema activo</span>
        </div>
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 30,
            height: 30,
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          PM
        </div>
      </div>
    </header>
  );
}
