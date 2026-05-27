"use client";

import { createContext, useContext, useState, ReactNode, CSSProperties } from "react";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  cardGlass: React.CSSProperties;
  colors: {
    background: string;
    navbar: string;
    card: string;
    cardHover: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    accentMutedBg: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    link: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark(!isDark);

  const colors = isDark
    ? {
        background: "#09090b",
        navbar: "#0c0c0f",
        card: "rgba(255,255,255,0.04)",
        cardHover: "rgba(255,255,255,0.07)",
        textPrimary: "#fafafa",
        textSecondary: "#a1a1aa",
        textMuted: "#52525b",
        accent: "#6366f1",
        accentHover: "#4f46e5",
        accentMutedBg: "rgba(99,102,241,0.12)",
        border: "rgba(255,255,255,0.08)",
        error: "#ef4444",
        warning: "#f59e0b",
        success: "#22c55e",
        link: "#818cf8",
      }
    : {
        background: "#f4f4f5",
        navbar: "#ffffff",
        card: "rgba(255,255,255,0.85)",
        cardHover: "rgba(255,255,255,0.98)",
        textPrimary: "#09090b",
        textSecondary: "#52525b",
        textMuted: "#a1a1aa",
        accent: "#4f46e5",
        accentHover: "#4338ca",
        accentMutedBg: "rgba(79,70,229,0.08)",
        border: "rgba(0,0,0,0.08)",
        error: "#dc2626",
        warning: "#d97706",
        success: "#16a34a",
        link: "#4f46e5",
      };

  const cardGlass: CSSProperties = {
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: isDark
      ? "0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)"
      : "0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, cardGlass, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
