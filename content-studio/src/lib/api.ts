export function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (base) return base.replace(/\/$/, "");
  return "http://127.0.0.1:8080";
}

export type TrendItem = {
  title: string;
  summary: string;
  source: string;
  url: string;
};

export type TopicAngle = {
  id: string;
  label: string;
  search_query: string;
};

export async function fetchTopicAngles(topic: string): Promise<TopicAngle[]> {
  const res = await fetch(`${apiBase()}/topic-angles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail: unknown }).detail)
        : await res.text();
    throw new Error(detail || `Topic angles failed (${res.status})`);
  }
  const data = (await res.json()) as { angles: TopicAngle[] };
  return data.angles;
}

export async function fetchTrends(
  topics: string,
  selectedQueries?: string[]
): Promise<TrendItem[]> {
  const body: { topics: string; selected_queries?: string[] } = { topics };
  if (selectedQueries && selectedQueries.length > 0) {
    body.selected_queries = selectedQueries;
  }
  const res = await fetch(`${apiBase()}/trends`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Trends failed (${res.status})`);
  }
  const data = (await res.json()) as { items: TrendItem[] };
  return data.items;
}

export type TrendFilterResult = {
  items: TrendItem[];
  note: string;
  used_fallback: boolean;
};

export async function filterTrendsForRelevance(
  topic: string,
  items: TrendItem[]
): Promise<TrendFilterResult> {
  const res = await fetch(`${apiBase()}/trends/filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail: unknown }).detail)
        : await res.text();
    throw new Error(detail || `Trend filter failed (${res.status})`);
  }
  return res.json() as Promise<TrendFilterResult>;
}

export type GenerateResult = {
  linkedin_post: string;
  image_prompt: string;
  hashtags: string[];
};

export type LlmHealthResult = {
  ok: boolean;
  provider: string | null;
  model: string | null;
  reply_preview: string | null;
  error: string | null;
};

export async function fetchLlmHealth(): Promise<LlmHealthResult> {
  const res = await fetch(`${apiBase()}/health/llm`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `LLM health failed (${res.status})`);
  }
  return res.json() as Promise<LlmHealthResult>;
}

export async function generatePost(body: {
  items: TrendItem[];
  tone: string;
  extra_instructions?: string;
  /** Layered onto the API’s default system prompt (voice, rules, persona). */
  system_prompt?: string;
  include_image_prompt?: boolean;
}): Promise<GenerateResult> {
  const res = await fetch(`${apiBase()}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail: unknown }).detail)
        : await res.text();
    throw new Error(detail || `Generate failed (${res.status})`);
  }
  return res.json() as Promise<GenerateResult>;
}

export async function generateImage(prompt: string): Promise<string> {
  const res = await fetch(`${apiBase()}/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const detail =
      err && typeof err === "object" && "detail" in err
        ? String((err as { detail: unknown }).detail)
        : await res.text();
    throw new Error(detail || `Image failed (${res.status})`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
