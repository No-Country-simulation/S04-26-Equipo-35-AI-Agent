"use client";
import { useTheme } from "../context/theme-context";
import { TrendData } from "../lib/api";

export function TrendChart({ data: initialData }: { data?: TrendData[] }) {
  const { colors } = useTheme();

  const fallbackData = [
    { month: "Sin datos", es: 0, pt: 0 },
  ];

  const data = initialData && initialData.length > 0 ? initialData : fallbackData;
  const maxVal = Math.max(...data.map(d => d.es + d.pt), 10);

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
            const esHeight = (d.es / maxVal) * 100;
            const ptHeight = (d.pt / maxVal) * 100;

            return (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
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
