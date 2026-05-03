import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../context/theme-context";

export function TopNav() {
  const pathname = usePathname();
  const { colors } = useTheme();

  const links = [
    { label: "Dashboard", href: "/" },
    { label: "Flujos", href: "/flujos" },
    { label: "Intenciones", href: "/intenciones" },
    { label: "Reportes", href: "/reportes" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header
      className="flex shrink-0 items-center justify-between px-5 h-14 border-b"
      style={{ backgroundColor: colors.navbar, borderColor: colors.border }}
    >
      <div className="flex items-center gap-8">
        <div style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
          ConversaAI
        </div>
        <nav className="flex items-center gap-6">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="no-underline transition-colors"
                style={{
                  color: active ? colors.accent : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: "transparent",
            color: colors.textSecondary,
            fontSize: 12,
            border: `1px solid ${colors.textSecondary}`,
          }}
        >
          Abril 2025
          <ChevronDown size={14} />
        </button>

        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            backgroundColor: colors.accent,
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          CP
        </div>
      </div>
    </header>
  );
}
