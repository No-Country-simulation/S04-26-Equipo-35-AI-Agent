"use client";
import { LayoutDashboard, AlertTriangle, Target, Upload, Activity, History, FileText, Kanban, Sun, Moon } from "lucide-react";

import Link from "next/link";
import { useTheme } from "../context/theme-context";

type Item = { label: string; icon: React.ReactNode; active?: boolean; href: string };

function MenuItem({ item }: { item: Item }) {
  const { colors } = useTheme();
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 mx-2 px-3 py-2 cursor-pointer no-underline transition-all duration-150"
      style={{
        color: item.active ? "#fafafa" : colors.textSecondary,
        backgroundColor: item.active ? "rgba(99,102,241,0.15)" : "transparent",
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: item.active ? 500 : 400,
      }}
    >
      <span style={{ color: item.active ? "#818cf8" : colors.textMuted }}>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      padding: "14px 18px 6px",
    }}>
      {children}
    </div>
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
    { label: "Solicitudes", icon: <Target size={14} />, active: activeItem === "Solicitudes", href: "/intenciones" },
    { label: "Acciones", icon: <Kanban size={14} />, active: activeItem === "Acciones", href: "/acciones" },
    { label: "Reportes", icon: <FileText size={14} />, active: activeItem === "Reportes", href: "/reportes" },
  ];
  const analista: Item[] = [
    { label: "Pipeline datos", icon: <Upload size={14} />, active: activeItem === "Pipeline datos", href: "/corpus/cargar" },
    { label: "Métricas modelo", icon: <Activity size={14} />, active: activeItem === "Métricas modelo", href: "/metricas-modelo" },
    { label: "Historial", icon: <History size={14} />, active: activeItem === "Historial", href: "/historial" },
  ];

  return (
    <aside
      className="flex h-full min-h-0 w-[220px] shrink-0 flex-col overflow-y-auto"
      style={{ background: colors.navbar, borderRight: `1px solid ${colors.border}` }}
    >
      {/* Logo header */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <div style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>C</span>
        </div>
        <span style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em" }}>
          ConversaAI
        </span>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-2">
        <SectionLabel>Producto</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {producto.map((i) => <MenuItem key={i.label} item={i} />)}
        </div>
        <div className="my-3 mx-4" style={{ borderTop: `1px solid ${colors.border}` }} />
        <SectionLabel>Analista</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {analista.map((i) => <MenuItem key={i.label} item={i} />)}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 mx-2 mb-2 flex items-center justify-between" style={{ borderTop: `1px solid ${colors.border}` }}>
        <span style={{ fontSize: 11, color: colors.textMuted }}>Tema</span>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all"
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            color: colors.textSecondary,
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          {isDark ? <Sun size={12} /> : <Moon size={12} />}
          <span>{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </aside>
  );
}