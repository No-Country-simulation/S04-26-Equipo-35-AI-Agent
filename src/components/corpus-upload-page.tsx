import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { Sidebar } from "./sidebar";
import { ArrowUp, CheckCircle, AlertCircle } from "lucide-react";
import { useTheme } from "../context/theme-context";

// ─── Estado 1 — Sin archivo ──────────────────────────────────────────────────
function Estado1() {
  const { colors } = useTheme();

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 20,
        }}
      >
        Estado 1 — sin archivo
      </div>

      <div
        style={{
          backgroundColor: colors.background,
          border: `1.5px dashed ${colors.textSecondary}`,
          borderRadius: 12,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        <div style={{ color: colors.textSecondary, marginBottom: 4 }}>
          <ArrowUp size={40} strokeWidth={1.5} />
        </div>
        <div style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600 }}>
          Arrastrá el archivo aquí
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 12 }}>
          o seleccioná desde tu computadora
        </div>
        <div style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 8 }}>
          Formatos aceptados: CSV · JSON · máx. 500MB
        </div>
        <button
          style={{
            color: colors.accent,
            fontSize: 12,
            border: `1px solid ${colors.accent}`,
            borderRadius: 8,
            padding: "8px 16px",
            backgroundColor: "transparent",
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          Seleccionar archivo
        </button>
      </div>
    </div>
  );
}

// ─── Estado 2 — Procesando ───────────────────────────────────────────────────
function Estado2() {
  const { colors } = useTheme();

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const steps = [
    { num: 1, label: "Validación", status: "completed" },
    { num: 2, label: "Limpieza", status: "completed" },
    { num: 3, label: "Embeddings", status: "active" },
    { num: 4, label: "Clasificación", status: "pending" },
    { num: 5, label: "Agregación", status: "pending" },
  ];

  const logs = [
    {
      time: "09:12:01",
      message: "✓ Validación completada — 2.134.872 filas · 0 errores críticos",
      color: colors.success,
    },
    {
      time: "09:12:34",
      message: "✓ Limpieza completada — ES: 1.4M · PT: 734k",
      color: colors.success,
    },
    {
      time: "09:13:10",
      message: "⚑ 842 mensajes con encoding inusual — normalizados",
      color: colors.warning,
    },
    {
      time: "09:14:02",
      message: "⋯ Generando embeddings BETO (ES) — 68% completado",
      color: colors.textSecondary,
    },
  ];

  return (
    <div style={cardStyle}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 24,
        }}
      >
        Estado 2 — procesando
      </div>

      {/* Stepper */}
      <div style={{ position: "relative", marginBottom: 32 }}>
        <div className="flex items-center justify-between" style={{ position: "relative" }}>
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center" style={{ flex: 1, position: "relative" }}>
              {/* Connecting line */}
              {idx < steps.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 12,
                    width: "100%",
                    height: 2,
                    backgroundColor:
                      step.status === "completed" ? colors.accent : colors.border,
                    zIndex: 0,
                  }}
                />
              )}

              {/* Circle */}
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor:
                    step.status === "completed" || step.status === "active" ? colors.accent : colors.card,
                  border:
                    step.status === "pending" ? `1.5px solid ${colors.textSecondary}` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                  fontSize: 11,
                  fontWeight: 600,
                  color: step.status === "pending" ? colors.textSecondary : "#FFFFFF",
                }}
              >
                {step.status === "completed" ? (
                  <span style={{ fontSize: 14, color: "#FFFFFF" }}>✓</span>
                ) : (
                  step.num
                )}
              </div>

              {/* Label */}
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color:
                    step.status === "active"
                      ? colors.textPrimary
                      : step.status === "completed"
                      ? colors.accent
                      : colors.textSecondary,
                  fontWeight: step.status === "active" ? 600 : 400,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            height: 6,
            backgroundColor: colors.background,
            borderRadius: 3,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "52%",
              backgroundColor: colors.accent,
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      {/* Progress info */}
      <div className="flex justify-between" style={{ marginBottom: 20 }}>
        <span style={{ color: colors.textSecondary, fontSize: 11 }}>
          corpus_abril_2025.csv · 2.1M mensajes
        </span>
        <span style={{ color: colors.textSecondary, fontSize: 11 }}>
          52% · ~4 min restantes
        </span>
      </div>

      {/* Log box */}
      <div
        style={{
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 12,
          fontFamily: "monospace",
        }}
      >
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: i < logs.length - 1 ? 6 : 0 }}>
            <span style={{ color: colors.textSecondary, fontSize: 11 }}>{log.time}</span>
            <span style={{ color: colors.textSecondary, fontSize: 11 }}> · </span>
            <span style={{ color: log.color, fontSize: 11 }}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Estado 3 — Error de validación ──────────────────────────────────────────
function Estado3() {
  const { colors, isDark } = useTheme();

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  return (
    <div style={cardStyle}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 20,
        }}
      >
        Estado 3 — error de validación
      </div>

      <div
        style={{
          backgroundColor: isDark ? "rgba(255,92,92,0.06)" : "rgba(229,57,53,0.06)",
          border: `1px solid ${colors.error}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div className="flex items-start gap-2" style={{ marginBottom: 8 }}>
          <AlertCircle size={16} color={colors.error} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 600 }}>
            Error en validación del archivo
          </div>
        </div>

        <div style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
          Se encontraron 3 problemas que impiden el procesamiento:
        </div>

        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: colors.error,
            lineHeight: 1.6,
          }}
        >
          <div>· Fila 14.832: columna &quot;timestamp&quot; vacía — requerida</div>
          <div>· Fila 89.201: &quot;lang&quot; contiene valor no reconocido: &quot;br&quot;</div>
          <div>· Columna &quot;conversation_id&quot; ausente en el archivo</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          style={{
            color: colors.error,
            fontSize: 12,
            border: `1px solid ${colors.error}`,
            borderRadius: 8,
            padding: "8px 16px",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        >
          Descargar reporte de errores
        </button>
        <button
          style={{
            color: "#FFFFFF",
            fontSize: 12,
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            backgroundColor: colors.accent,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Cargar archivo corregido
        </button>
      </div>
    </div>
  );
}

// ─── Estado 4 — Completado ───────────────────────────────────────────────────
function Estado4() {
  const { colors } = useTheme();

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    padding: 24,
  };

  const stats = [
    { label: "Mensajes procesados", value: "2.13M", color: colors.textPrimary },
    { label: "Idioma ES", value: "1.40M", color: colors.textPrimary },
    { label: "Idioma PT", value: "734k", color: colors.textPrimary },
    { label: "Errores no críticos", value: "842", color: colors.warning },
  ];

  return (
    <div style={cardStyle}>
      <div
        style={{
          color: colors.textMuted,
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 20,
        }}
      >
        Estado 4 — procesamiento completado
      </div>

      {/* Summary grid */}
      <div
        className="grid grid-cols-4 gap-4"
        style={{
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col">
            <div style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 6 }}>
              {stat.label}
            </div>
            <div style={{ color: stat.color, fontSize: 20, fontWeight: 600 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Success message */}
      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        <CheckCircle size={14} color={colors.success} />
        <span style={{ color: colors.success, fontSize: 12, fontWeight: 600 }}>
          ✓ Pipeline completado en 9 min 42 seg
        </span>
      </div>

      {/* CTA button */}
      <div className="flex justify-end">
        <button
          style={{
            color: colors.accent,
            fontSize: 12,
            border: `1px solid ${colors.accent}`,
            borderRadius: 8,
            padding: "8px 16px",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        >
          Ver métricas del modelo →
        </button>
      </div>
    </div>
  );
}

// ─── Full Page ────────────────────────────────────────────────────────────────
export function CorpusUploadPage() {
  const { colors } = useTheme();

  return (
    <DashboardShell sidebar={<Sidebar activeItem="Cargar corpus" />} mainClassName="space-y-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1" style={{ fontSize: 12 }}>
            <Link
              href="/"
              style={{ color: colors.textSecondary, textDecoration: "none" }}
              className="hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span style={{ color: colors.textSecondary, margin: "0 4px" }}>›</span>
            <span style={{ color: colors.textPrimary }}>Cargar corpus</span>
          </nav>

          {/* Page Header */}
          <h1 style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 600, margin: 0 }}>
            Cargar corpus mensual
          </h1>

          {/* All 4 states in vertical sequence */}
          <Estado1 />
          <Estado2 />
          <Estado3 />
          <Estado4 />
    </DashboardShell>
  );
}
