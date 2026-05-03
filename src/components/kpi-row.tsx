import { useTheme } from "../context/theme-context";

type Kpi = { label: string; value: string; delta: string; deltaColor: string };

export function KpiRow() {
  const { colors } = useTheme();

  const kpis: Kpi[] = [
    { label: "TASA DE RESOLUCIÓN", value: "64%", delta: "▼ 3% vs mes ant.", deltaColor: colors.error },
    { label: "ÍNDICE DE FRUSTRACIÓN", value: "31%", delta: "▲ 5% vs mes ant.", deltaColor: colors.error },
    { label: "INTENCIONES SIN RESOLVER", value: "18", delta: "▲ 2 nuevas", deltaColor: colors.error },
    { label: "FLUJOS CRÍTICOS", value: "4", delta: "sin cambio", deltaColor: colors.textMuted },
  ];

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 16,
    height: 110,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12, alignItems: "stretch" }}>
      {kpis.map((k) => (
        <div key={k.label} style={cardStyle}>
          <div
            style={{
              color: colors.textMuted,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {k.label}
          </div>
          <div style={{ color: colors.textPrimary, fontSize: 28, fontWeight: 600 }}>
            {k.value}
          </div>
          <div style={{ color: k.deltaColor, fontSize: 11 }}>{k.delta}</div>
        </div>
      ))}
    </div>
  );
}
