import { useTheme } from "../context/theme-context";

export function TrendChart() {
  const { colors } = useTheme();

  const data = [
    { month: "Nov", es: 32, pt: 28 },
    { month: "Dic", es: 38, pt: 31 },
    { month: "Ene", es: 35, pt: 33 },
    { month: "Feb", es: 48, pt: 42 },
    { month: "Mar", es: 56, pt: 51 },
    { month: "Abr", es: 64, pt: 58 },
  ];

  return (
    <div
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        padding: 16,
        minHeight: 180,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div
          style={{
            color: colors.textMuted,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          TENDENCIA DE FRUSTRACIÓN — ÚLTIMOS 6 MESES
        </div>
        {/* Legend */}
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#1A8FE3",
              }}
            />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>ES</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: colors.accent,
              }}
            />
            <span style={{ color: colors.textMuted, fontSize: 11 }}>PT</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ position: "relative", height: 200 }}>
        {/* Grid lines */}
        <div style={{ position: "absolute", inset: "0 0 25px 0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderTop: `1px solid ${colors.textMuted}20` }} />
          ))}
        </div>

        {/* Bars */}
        <div style={{ position: "absolute", inset: "0 0 25px 0", display: "flex", alignItems: "flex-end", gap: 16 }}>
          {data.map((d) => {
            const esHeight = (d.es / 75) * 100;
            const ptHeight = (d.pt / 75) * 100;

            return (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", display: "flex", gap: 4, alignItems: "flex-end", height: "100%" }}>
                  <div
                    style={{
                      flex: 1,
                      height: `${esHeight}%`,
                      backgroundColor: "#1A8FE3",
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: `${ptHeight}%`,
                      backgroundColor: colors.accent,
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>{d.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
