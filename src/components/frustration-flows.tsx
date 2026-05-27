"use client";

import Link from "next/link";
import { useTheme } from "../context/theme-context";
import { FlowFrustration } from "../lib/api";

type Row = { name: string; value: number; color: string; opacity?: number; href?: string };

export function FrustrationFlows({ data }: { data?: FlowFrustration[] }) {
  const { colors } = useTheme();

  const fallbackRows: Row[] = [
    { name: "Sin datos", value: 0, color: colors.textMuted }
  ];

  const rows: Row[] = data && data.length > 0 
    ? data.map(d => {
        let color = colors.textMuted;
        let opacity = 1;
        if (d.frustrationScore >= 75) color = colors.error;
        else if (d.frustrationScore >= 50) color = colors.warning;
        else if (d.frustrationScore >= 25) { color = colors.warning; opacity = 0.75; }
        
        return {
          name: d.intent.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          value: d.frustrationScore,
          color,
          opacity
        };
      })
    : fallbackRows;

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
        PUNTOS DE MAYOR FRICCIÓN
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
                    minWidth: "4px",
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
            <div key={r.name} className="flex items-center hover:opacity-80 transition-opacity" style={{ height: 32, gap: 12, cursor: "default" }}>
              <div style={{ width: 110, color: colors.textPrimary, fontSize: 12 }}>{r.name}</div>
              <div className="flex-1 overflow-hidden" style={{ backgroundColor: colors.background, height: 8, borderRadius: 4 }}>
                <div
                  style={{
                    width: `${r.value}%`,
                    minWidth: "4px",
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
        Ver detalle por punto de contacto →
      </div>
    </div>
  );
}