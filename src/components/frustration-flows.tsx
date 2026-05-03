import Link from "next/link";
import { useTheme } from "../context/theme-context";

type Row = { name: string; value: number; color: string; opacity?: number; href?: string };

export function FrustrationFlows() {
  const { colors } = useTheme();

  const rows: Row[] = [
    { name: "Devoluciones", value: 82, color: colors.error, href: "/flujos/devoluciones" },
    { name: "Cambio de plan", value: 71, color: colors.error, opacity: 0.75 },
    { name: "Soporte técnico", value: 58, color: colors.warning },
    { name: "Facturación", value: 44, color: colors.warning, opacity: 0.75 },
    { name: "Onboarding", value: 29, color: colors.textMuted },
  ];

  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        padding: 16,
        minHeight: 340,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          color: colors.textMuted,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        FLUJOS CON MÁS FRUSTRACIÓN
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.map((r) => (
          r.href ? (
            <Link
              key={r.name}
              href={r.href}
              className="flex items-center no-underline hover:opacity-90 transition-opacity"
              style={{ textDecoration: "none", height: 32, gap: 12 }}
            >
              <div style={{ width: 110, color: colors.textPrimary, fontSize: 12 }}>
                {r.name}
              </div>
              <div className="flex-1 overflow-hidden" style={{ backgroundColor: colors.background, height: 8, borderRadius: 4 }}>
                <div
                  style={{
                    width: `${r.value}%`,
                    height: "100%",
                    backgroundColor: r.color,
                    opacity: r.opacity ?? 1,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ width: 36, textAlign: "right", color: colors.textMuted, fontSize: 11 }}>
                {r.value}%
              </div>
            </Link>
          ) : (
            <div key={r.name} className="flex items-center" style={{ height: 32, gap: 12 }}>
              <div style={{ width: 110, color: colors.textPrimary, fontSize: 12 }}>{r.name}</div>
              <div className="flex-1 overflow-hidden" style={{ backgroundColor: colors.background, height: 8, borderRadius: 4 }}>
                <div
                  style={{
                    width: `${r.value}%`,
                    height: "100%",
                    backgroundColor: r.color,
                    opacity: r.opacity ?? 1,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ width: 36, textAlign: "right", color: colors.textMuted, fontSize: 11 }}>
                {r.value}%
              </div>
            </div>
          )
        ))}
      </div>
      <div style={{ color: colors.accent, fontSize: 11, marginTop: "auto" }}>
        Click en un flujo para ver detalle →
      </div>
    </div>
  );
}