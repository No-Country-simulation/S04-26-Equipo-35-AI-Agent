import Link from "next/link";
import { useTheme } from "../context/theme-context";

type Intent = {
  name: string;
  count: string;
  badge: string;
  href?: string;
};

export function TopIntents() {
  const { colors, isDark } = useTheme();

  const getBadgeColors = (badge: string) => {
    if (badge === "crítico") {
      return {
        bg: isDark ? "#FF5C5C15" : "#FEE2E2",
        color: colors.error,
        border: `1px solid ${colors.error}40`,
      };
    }
    if (badge === "medio") {
      return {
        bg: isDark ? "#F5A62315" : "#FEF3C7",
        color: colors.warning,
        border: `1px solid ${colors.warning}40`,
      };
    }
    return {
      bg: isDark ? "#4A658015" : "#E0E7EF",
      color: colors.textSecondary,
      border: `1px solid ${colors.textMuted}40`,
    };
  };

  const items: Intent[] = [
    { name: "Cancelar suscripción", count: "4.2k mensajes afectados", badge: "crítico", href: "/intenciones/cancelar-suscripcion" },
    { name: "Reembolso parcial", count: "2.8k mensajes afectados", badge: "crítico" },
    { name: "Portabilidad de datos", count: "1.1k mensajes afectados", badge: "medio" },
    { name: "Error de pago recurrente", count: "980 mensajes afectados", badge: "medio" },
    { name: "Cambio de titular", count: "540 mensajes afectados", badge: "bajo" },
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
        TOP INTENCIONES SIN RESOLVER
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {items.map((it, idx) => {
          const badgeColors = getBadgeColors(it.badge);
          const content = (
            <>
              <div>
                <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>
                  {it.name}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{it.count}</div>
              </div>
              <span
                className="px-2 py-1 rounded-md"
                style={{
                  backgroundColor: badgeColors.bg,
                  color: badgeColors.color,
                  fontSize: 11,
                  fontWeight: 500,
                  border: badgeColors.border,
                }}
              >
                {it.badge}
              </span>
            </>
          );

          return it.href ? (
            <Link
              key={it.name}
              href={it.href}
              className="flex items-center justify-between no-underline hover:opacity-90 transition-opacity"
              style={{
                borderBottom: idx < items.length - 1 ? `1px solid ${colors.border}` : "none",
                textDecoration: "none",
                flex: 1,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              {content}
            </Link>
          ) : (
            <div
              key={it.name}
              className="flex items-center justify-between"
              style={{
                borderBottom: idx < items.length - 1 ? `1px solid ${colors.border}` : "none",
                flex: 1,
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              {content}
            </div>
          );
        })}
      </div>
      <div style={{ color: colors.accent, fontSize: 11, marginTop: "auto" }}>
        Click en una intención para ver detalle →
      </div>
    </div>
  );
}