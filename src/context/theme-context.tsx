"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
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
        background: "#0D1F35",
        navbar: "#0A1828",
        card: "#162D47",
        cardHover: "#1E3654",
        textPrimary: "#FFFFFF",
        textSecondary: "#8BA8C4",
        textMuted: "#4A6580",
        accent: "#00C49A",
        accentHover: "#00E5B4",
        accentMutedBg: "#0A3D2E",
        border: "#1E3654",
        error: "#FF5C5C",
        warning: "#F5A623",
        success: "#00C49A",
        link: "#1A8FE3",
      }
    : {
        background: "#F0F4F8",
        navbar: "#FFFFFF",
        card: "#FFFFFF",
        cardHover: "#F8FAFB",
        textPrimary: "#0D1B2E",
        textSecondary: "#3D5A73",
        textMuted: "#7A96AD",
        accent: "#00A882",
        accentHover: "#007A5E",
        accentMutedBg: "#D6F5EE",
        border: "#E2E8F0",
        error: "#E53935",
        warning: "#E8920A",
        success: "#00A882",
        link: "#00A882",
      };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
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
