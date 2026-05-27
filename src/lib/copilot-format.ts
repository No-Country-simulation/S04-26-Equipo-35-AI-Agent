/** Extrae IDs de sesión citados en respuestas del copiloto. */
const SESSION_PATTERNS = [
  /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi,
  /\b(SES-[A-Z0-9][A-Z0-9-]*)\b/g,
  /session[_\s-]?id[:\s`]+([A-Za-z0-9_-]+)/gi,
  /sesión[:\s`]+([A-Za-z0-9_-]+)/gi,
];

export function extractSessionIds(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of SESSION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const id = (match[1] ?? match[0]).trim();
      if (id.length >= 4) found.add(id);
    }
  }
  return [...found].slice(0, 8);
}

/** Markdown ligero + resaltado de session_id para burbujas del asistente. */
export function renderCopilotMarkdown(text: string): string {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="copilot-inline-code">$1</code>'
    )
    .replace(/^- (.+)/gm, "• $1")
    .replace(/\n/g, "<br/>");

  html = html.replace(
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi,
    '<span class="copilot-session-ref" data-session-id="$1" title="ID de sesión">$1</span>'
  );
  html = html.replace(
    /\b(SES-[A-Z0-9][A-Z0-9-]*)\b/g,
    '<span class="copilot-session-ref" data-session-id="$1" title="ID de sesión">$1</span>'
  );

  return html;
}
