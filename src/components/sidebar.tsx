import { LayoutDashboard, AlertTriangle, Target, Upload, Activity, History, FileText } from "lucide-react";
import Link from "next/link";
import { useTheme } from "../context/theme-context";

type Item = { label: string; icon: React.ReactNode; active?: boolean; href: string };

function MenuItem({ item }: { item: Item }) {
  const { colors } = useTheme();
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer no-underline"
      style={{
        color: item.active ? colors.textPrimary : colors.textSecondary,
        backgroundColor: item.active ? colors.cardHover : "transparent",
        borderLeft: item.active ? `2px solid ${colors.accent}` : "2px solid transparent",
        fontSize: 12,
      }}
    >
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}

interface SidebarProps {
  activeItem?: string;
}

export function Sidebar({ activeItem = "Resumen" }: SidebarProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const producto: Item[] = [
    { label: "Resumen", icon: <LayoutDashboard size={14} />, active: activeItem === "Resumen", href: "/" },
    { label: "Frustración", icon: <AlertTriangle size={14} />, active: activeItem === "Frustración", href: "/frustracion" },
    { label: "Intenciones", icon: <Target size={14} />, active: activeItem === "Intenciones", href: "/intenciones" },
    { label: "Reportes", icon: <FileText size={14} />, active: activeItem === "Reportes", href: "/reportes" },
  ];
  const analista: Item[] = [
    { label: "Cargar corpus", icon: <Upload size={14} />, active: activeItem === "Cargar corpus", href: "/corpus/cargar" },
    { label: "Métricas modelo", icon: <Activity size={14} />, active: activeItem === "Métricas modelo", href: "/metricas-modelo" },
    { label: "Historial", icon: <History size={14} />, active: activeItem === "Historial", href: "/historial" },
  ];

  const sectionLabel: React.CSSProperties = {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "12px 14px 8px",
  };

  return (
    <aside
      className="flex h-full min-h-0 w-[160px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: colors.navbar, borderRight: `1px solid ${colors.border}` }}
    >
      <div>
        <div style={sectionLabel}>Producto</div>
        <div className="flex flex-col">
          {producto.map((i) => <MenuItem key={i.label} item={i} />)}
        </div>
        <div className="my-3 mx-3" style={{ borderTop: `1px solid ${colors.border}` }} />
        <div style={sectionLabel}>Analista</div>
        <div className="flex flex-col">
          {analista.map((i) => <MenuItem key={i.label} item={i} />)}
        </div>
      </div>

      {/* Footer with dark mode toggle */}
      <div className="mt-auto p-3" style={{ borderTop: `1px solid ${colors.border}` }}>
        <button
          onClick={toggleTheme}
          className="relative rounded-full transition-all mx-auto block"
          style={{
            width: 44,
            height: 24,
            backgroundColor: isDark ? "#162D47" : "#E2E8F0",
            border: isDark ? "1px solid #00C49A" : "1px solid #00A882",
            cursor: "pointer",
            padding: 2,
          }}
        >
          <div
            className="rounded-full transition-transform duration-200"
            style={{
              width: 18,
              height: 18,
              backgroundColor: isDark ? "#00C49A" : "#00A882",
              transform: isDark ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </button>
      </div>
    </aside>
  );
}