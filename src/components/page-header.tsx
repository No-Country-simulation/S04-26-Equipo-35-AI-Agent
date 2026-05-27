"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { useTheme } from "../context/theme-context";

type PageHeaderProps = {
  totalSessions?: number;
  totalMessages?: number;
  previousPeriod?: string;
};

export function PageHeader({ totalSessions, totalMessages, previousPeriod }: PageHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("lang") || "Todos los flujos";

  // Format large numbers
  const fmtCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toString();
  };

  const subtitle = totalMessages
    ? `${fmtCount(totalMessages)} mensajes procesados · ${totalSessions || 0} sesiones · ES + PT`
    : "Cargando datos...";

  const pills = [
    { label: "Todos los flujos", val: "" },
    { label: "ES", val: "ES" },
    { label: "PT", val: "PT" },
  ];

  const handleFilterClick = (label: string, val: string) => {
    if (val) {
      router.push(`/?lang=${val}`);
    } else {
      router.push(`/`);
    }
  };

  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <div style={{ color: colors.textPrimary, fontSize: 22, fontWeight: 700 }}>
          Resumen del mes
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
          {subtitle}
        </div>
        {previousPeriod && (
          <div style={{ color: colors.accent, fontSize: 11, marginTop: 2 }}>
            Comparando con período {previousPeriod}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {pills.map((p) => {
          const isActive = activeFilter === p.label || activeFilter === p.val;
          return (
            <button
              key={p.label}
              onClick={() => handleFilterClick(p.label, p.val)}
              className="px-3 py-1.5 transition-colors hover:bg-slate-800/50"
              style={{
                fontSize: 11,
                color: isActive ? colors.accent : colors.textSecondary,
                backgroundColor: "transparent",
                border: isActive ? `1px solid ${colors.accent}` : `1px solid ${colors.textSecondary}`,
                borderRadius: 20,
                fontWeight: isActive ? 500 : 400,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-1.5 transition-opacity hover:opacity-80"
          style={{
            border: `1px solid ${colors.accent}`,
            color: colors.accent,
            fontSize: 12,
            backgroundColor: colors.card,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <Download size={14} />
          Exportar PDF
        </button>
      </div>
    </div>
  );
}
