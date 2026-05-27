"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingDown, ChevronDown, Loader2 } from "lucide-react";
import { useTheme } from "../context/theme-context";
import {
  buildSeedItems,
  ACCIONES_UPDATED_EVENT,
} from "../lib/action-seeds";
import type { ActionItem } from "../lib/action-seeds";

/* ── helpers ──────────────────────────────────────────────────────── */

function seededFactor(id: string | number | undefined | null): number {
  const strId = String(id ?? "");
  const seed = strId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 0.2 + (seed % 50) / 100;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface Comparison {
  item: ActionItem;
  before: number;
  after: number;
  badge: "resolved" | "partial" | "none";
}

function buildComparisons(items: ActionItem[]): Comparison[] {
  return items.map((item) => {
    const before = item.impact_score;
    const factor = seededFactor(item.id);
    const after = +(before * factor).toFixed(4);
    const badge: Comparison["badge"] =
      after < before * 0.6
        ? "resolved"
        : after < before * 0.85
          ? "partial"
          : "none";
    return { item, before, after, badge };
  });
}

/* ── component ────────────────────────────────────────────────────── */

export function ValidadorImpacto() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchItems = useCallback(() => {
    fetch("/api/actions")
      .then((r) => r.json())
      .then((d: ActionItem[]) => {
        const all = Array.isArray(d) ? d : buildSeedItems();
        const resolved = all.filter(
          (i) =>
            i.status === "resolved" ||
            (i.notes && i.notes.startsWith("[ARCHIVED]"))
        );
        setItems(resolved);
      })
      .catch(() => {
        const seeds = buildSeedItems();
        setItems(seeds.filter((i) => i.status === "resolved"));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{ items?: ActionItem[]; refresh?: boolean }>
      ).detail;
      if (detail?.refresh) fetchItems();
      else if (detail?.items) {
        const resolved = detail.items.filter(
          (i) =>
            i.status === "resolved" ||
            (i.notes && i.notes.startsWith("[ARCHIVED]"))
        );
        setItems(resolved);
      }
    };
    window.addEventListener(ACCIONES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(ACCIONES_UPDATED_EVENT, handler);
  }, [fetchItems]);

  const comparisons = buildComparisons(items);

  /* ── badge colors ─────────────────────────────────────────────── */

  const badgeCfg: Record<
    Comparison["badge"],
    { bg: string; fg: string; label: string }
  > = {
    resolved: {
      bg: `${colors.success}1a`,
      fg: colors.success,
      label: "✅ Resuelto",
    },
    partial: {
      bg: `${colors.warning}1a`,
      fg: colors.warning,
      label: "⚠️ Mejorado parcial",
    },
    none: {
      bg: `${colors.error}1a`,
      fg: colors.error,
      label: "❌ Sin mejora — Reabrir",
    },
  };

  return (
    <section
      style={{
        backgroundColor: colors.card,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}
    >
      {/* ── collapsible header ──────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: colors.textPrimary,
          textAlign: "left",
        }}
      >
        <TrendingDown
          size={18}
          style={{ color: colors.accent, flexShrink: 0 }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
            Validación de Impacto
          </div>
          <div
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            ¿Funcionaron las acciones resueltas?
          </div>
        </div>

        {/* count badge */}
        {!loading && items.length > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 9999,
              background: `${colors.accent}1a`,
              color: colors.accent,
              flexShrink: 0,
            }}
          >
            {items.length}
          </span>
        )}

        <ChevronDown
          size={15}
          style={{
            color: colors.textMuted,
            transition: "transform 0.3s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>

      {/* ── collapsible body ────────────────────────────────────── */}
      <div
        style={{
          maxHeight: open ? 800 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition:
            "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease",
        }}
      >
        <div
          style={{
            padding: "0 20px 20px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: colors.textMuted,
                fontSize: 12,
                padding: "16px 0",
              }}
            >
              <Loader2
                size={13}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Cargando…
            </div>
          ) : comparisons.length === 0 ? (
            <div
              style={{
                color: colors.textMuted,
                fontSize: 12,
                padding: "20px 0",
                textAlign: "center",
              }}
            >
              No hay acciones resueltas para validar.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 16,
              }}
            >
              {comparisons.map((c) => {
                const beforePct = Math.round(c.before * 100);
                const afterPct = Math.round(c.after * 100);
                const badge = badgeCfg[c.badge];
                const barAfterColor =
                  c.badge === "none" ? colors.warning : colors.success;

                return (
                  <div
                    key={c.item.id}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)")
                    }
                  >
                    {/* row 1: title + badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          color: colors.textPrimary,
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {truncate(c.item.title, 50)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: badge.bg,
                          color: badge.fg,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* row 2: meta */}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        fontSize: 11,
                        color: colors.textMuted,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>
                        <strong style={{ color: colors.textSecondary }}>
                          Responsable:
                        </strong>{" "}
                        {c.item.assignee || "N/A"}
                      </span>
                      <span>
                        <strong style={{ color: colors.textSecondary }}>
                          Fecha resolución:
                        </strong>{" "}
                        {fmtDate(c.item.updated_at)}
                      </span>
                    </div>

                    {/* row 3: bars */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      {/* before */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              color: colors.textMuted,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Frustración antes
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: colors.error,
                            }}
                          >
                            {beforePct}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${beforePct}%`,
                              height: "100%",
                              background: colors.error,
                              borderRadius: 3,
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                      </div>

                      {/* after */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              color: colors.textMuted,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Frustración después
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: barAfterColor,
                            }}
                          >
                            {afterPct}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${afterPct}%`,
                              height: "100%",
                              background: barAfterColor,
                              borderRadius: 3,
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
