"use client";

import type { ReactNode } from "react";
import { TopNav } from "./top-nav";
import { useTheme } from "../context/theme-context";
import { cn } from "./ui/utils";

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
      style={{ backgroundColor: colors.background, fontFamily: "Inter, sans-serif", color: colors.textPrimary }}
    >
      <TopNav />
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className={cn("min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-5", mainClassName)}>{children}</main>
      </div>
    </div>
  );
}
