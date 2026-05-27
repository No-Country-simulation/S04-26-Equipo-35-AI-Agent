"use client";

import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { useTheme } from "../context/theme-context";
import { cn } from "./ui/utils";
import { CopilotChat } from "./copilot-chat";

type DashboardShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  /** Tailwind extras for the scrollable `<main>` (e.g. `space-y-4`). */
  mainClassName?: string;
};

export function DashboardShell({ sidebar, children, mainClassName }: DashboardShellProps) {
  const { colors } = useTheme();

  return (
    <div
      className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden"
      style={{
        background: colors.background,
        backgroundImage: `radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99,102,241,0.07) 0%, transparent 60%)`,
        color: colors.textPrimary,
      }}
    >
      <div className="print:hidden"><TopNav /></div>
      <div className="flex min-h-0 flex-1">
        <div className="print:hidden">{sidebar}</div>
        <main className={cn("min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5 print:p-0", mainClassName)}>{children}</main>
      </div>
      <div className="print:hidden"><CopilotChat /></div>
    </div>
  );
}

