import { Download } from "lucide-react";
import { useTheme } from "../context/theme-context";

export function PageHeader() {
  const { colors } = useTheme();

  const pills = [
    { label: "Todos los flujos", active: true },
    { label: "ES", active: false },
    { label: "PT", active: false },
  ];

  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <div style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 600 }}>Resumen del mes</div>
        <div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
          2.1M mensajes procesados · ES + PT
        </div>
      </div>
      <div className="flex items-center gap-2">
        {pills.map((p) => (
          <button
            key={p.label}
            className="px-3 py-1.5"
            style={{
              fontSize: 11,
              color: p.active ? colors.accent : colors.textSecondary,
              backgroundColor: "transparent",
              border: p.active ? `1px solid ${colors.accent}` : `1px solid ${colors.textSecondary}`,
              borderRadius: 20,
              fontWeight: p.active ? 500 : 400,
              cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          className="flex items-center gap-2 px-3 py-1.5"
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
