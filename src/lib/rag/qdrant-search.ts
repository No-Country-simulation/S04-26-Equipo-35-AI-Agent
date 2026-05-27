/**
 * Búsqueda semántica en Qdrant (colección messages) vía REST + Cohere embed.
 */
const QDRANT_URL = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
const COHERE_KEY = process.env.COHERE_API_KEY ?? "";
const COLLECTION =
  process.env.QDRANT_COLLECTION ?? "conversaai_messages";

export type ConversationSearchHit = {
  session_id: string;
  turn_id: number;
  text_preview: string;
  region: string;
  intent_label?: string;
  similarity: number;
};

async function embedQuery(query: string): Promise<number[]> {
  if (!COHERE_KEY) {
    throw new Error("COHERE_API_KEY no configurada");
  }
  const res = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COHERE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts: [query],
      model: "embed-multilingual-v3.0",
      input_type: "search_query",
      embedding_types: ["float"],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cohere embed failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    embeddings: { float: number[][] };
  };
  return data.embeddings.float[0];
}

export async function searchConversations(
  query: string,
  limit = 8
): Promise<ConversationSearchHit[]> {
  const vector = await embedQuery(query);
  const res = await fetch(
    `${QDRANT_URL}/collections/${COLLECTION}/points/search`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector,
        limit,
        with_payload: true,
        score_threshold: 0.55,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qdrant search failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    result: Array<{
      score: number;
      payload?: Record<string, unknown>;
    }>;
  };

  return data.result.map((r) => ({
    session_id: String(r.payload?.session_id ?? ""),
    turn_id: Number(r.payload?.turn_id ?? 0),
    text_preview: String(r.payload?.text_preview ?? ""),
    region: String(r.payload?.region ?? ""),
    intent_label: r.payload?.intencion_original
      ? String(r.payload.intencion_original)
      : undefined,
    similarity: Math.round(r.score * 1000) / 1000,
  }));
}
