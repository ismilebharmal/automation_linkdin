"use client";

import { useCallback, useMemo, useState } from "react";
import {
  apiBase,
  fetchLlmHealth,
  fetchTopicAngles,
  fetchTrends,
  filterTrendsForRelevance,
  generateImage,
  generatePost,
  type LlmHealthResult,
  type TopicAngle,
  type TrendItem,
} from "@/lib/api";

const TONE_OPTIONS = [
  "professional and concise",
  "technical peer-to-peer",
  "friendly and approachable",
  "thought-leader / opinionated",
] as const;

export default function Home() {
  const [topics, setTopics] = useState(
    "AI, machine learning, developer tools"
  );
  const [items, setItems] = useState<TrendItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [tone, setTone] = useState<string>(TONE_OPTIONS[0]);
  const [extra, setExtra] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [post, setPost] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingImg, setLoadingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** If true, /generate asks for image_prompt; if false, text-only schema. */
  const [includeImageIdeas, setIncludeImageIdeas] = useState(true);
  /** Mirrors what the last successful generation used (for section 3 layout). */
  const [generatedWithImageIdeas, setGeneratedWithImageIdeas] = useState(true);
  const [llmHealth, setLlmHealth] = useState<LlmHealthResult | null>(null);
  const [loadingLlmCheck, setLoadingLlmCheck] = useState(false);
  const [angles, setAngles] = useState<TopicAngle[]>([]);
  const [selectedAngles, setSelectedAngles] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingAngles, setLoadingAngles] = useState(false);
  /** Full list from last successful fetch; used to restore after AI filter. */
  const [fullFetchedBackup, setFullFetchedBackup] = useState<TrendItem[] | null>(
    null
  );
  const [hasAiFiltered, setHasAiFiltered] = useState(false);
  const [filterNote, setFilterNote] = useState<string | null>(null);
  const [filterUsedFallback, setFilterUsedFallback] = useState(false);
  const [loadingFilter, setLoadingFilter] = useState(false);

  const base = useMemo(() => apiBase(), []);

  const toggle = useCallback((idx: number) => {
    setSelected((s) => ({ ...s, [idx]: !s[idx] }));
  }, []);

  const selectAll = useCallback(() => {
    const next: Record<number, boolean> = {};
    items.forEach((_, i) => {
      next[i] = true;
    });
    setSelected(next);
  }, [items]);

  const clearSelection = useCallback(() => setSelected({}), []);

  const onBreakTopic = async () => {
    setError(null);
    const t = topics.trim();
    if (t.length < 3) {
      setError("Enter a topic (at least 3 characters) before breaking it into angles.");
      return;
    }
    setLoadingAngles(true);
    setAngles([]);
    setSelectedAngles({});
    try {
      const list = await fetchTopicAngles(t);
      setAngles(list);
      const init: Record<string, boolean> = {};
      list.forEach((a) => {
        init[a.id] = true;
      });
      setSelectedAngles(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get topic angles");
    } finally {
      setLoadingAngles(false);
    }
  };

  const toggleAngle = useCallback((id: string) => {
    setSelectedAngles((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const selectAllAngles = useCallback(() => {
    const next: Record<string, boolean> = {};
    angles.forEach((a) => {
      next[a.id] = true;
    });
    setSelectedAngles(next);
  }, [angles]);

  const clearAngles = useCallback(() => {
    setAngles([]);
    setSelectedAngles({});
  }, []);

  const onFetchTrends = async () => {
    setError(null);
    const t = topics.trim();
    if (t.length < 3) {
      setError("Enter a topic (at least 3 characters).");
      return;
    }
    const selectedQueries = angles
      .filter((a) => selectedAngles[a.id])
      .map((a) => a.search_query);
    if (angles.length > 0 && selectedQueries.length === 0) {
      setError(
        "Select at least one angle below, or click “Clear AI angles” to search the raw topic only."
      );
      return;
    }
    setLoadingTrends(true);
    setItems([]);
    setSelected({});
    setFullFetchedBackup(null);
    setHasAiFiltered(false);
    setFilterNote(null);
    setFilterUsedFallback(false);
    setPost("");
    setImagePrompt("");
    setHashtags([]);
    setImageUrl(null);
    try {
      const list = await fetchTrends(
        t,
        selectedQueries.length > 0 ? selectedQueries : undefined
      );
      setFullFetchedBackup(list);
      setItems(list);
      const init: Record<number, boolean> = {};
      list.forEach((_, i) => {
        init[i] = i < 4;
      });
      setSelected(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trends");
    } finally {
      setLoadingTrends(false);
    }
  };

  const onRestoreFullFetch = useCallback(() => {
    if (!fullFetchedBackup) return;
    setItems(fullFetchedBackup);
    setHasAiFiltered(false);
    setFilterNote(null);
    setFilterUsedFallback(false);
    const init: Record<number, boolean> = {};
    fullFetchedBackup.forEach((_, i) => {
      init[i] = i < 4;
    });
    setSelected(init);
  }, [fullFetchedBackup]);

  const onAiFilterRelevance = async () => {
    setError(null);
    const t = topics.trim();
    if (t.length < 3) {
      setError("Enter a topic (at least 3 characters).");
      return;
    }
    const sourceForFilter = fullFetchedBackup ?? items;
    if (sourceForFilter.length === 0) return;
    setLoadingFilter(true);
    try {
      const { items: next, note, used_fallback } = await filterTrendsForRelevance(
        t,
        sourceForFilter
      );
      setItems(next);
      setHasAiFiltered(true);
      setFilterNote(note.trim() ? note : null);
      setFilterUsedFallback(used_fallback);
      const init: Record<number, boolean> = {};
      next.forEach((_, i) => {
        init[i] = i < 4;
      });
      setSelected(init);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI filter failed");
    } finally {
      setLoadingFilter(false);
    }
  };

  const selectedItems = useMemo(() => {
    return items.filter((_, i) => selected[i]);
  }, [items, selected]);

  const onCheckLlm = async () => {
    setError(null);
    setLoadingLlmCheck(true);
    setLlmHealth(null);
    try {
      const h = await fetchLlmHealth();
      setLlmHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LLM health request failed");
    } finally {
      setLoadingLlmCheck(false);
    }
  };

  const onGenerate = async () => {
    setError(null);
    if (selectedItems.length === 0) {
      setError("Select at least one trend to generate a post.");
      return;
    }
    setLoadingGen(true);
    setPost("");
    setImagePrompt("");
    setHashtags([]);
    setImageUrl(null);
    setGeneratedWithImageIdeas(includeImageIdeas);
    try {
      const out = await generatePost({
        items: selectedItems,
        tone,
        extra_instructions: extra,
        include_image_prompt: includeImageIdeas,
      });
      setPost(out.linkedin_post);
      setImagePrompt(out.image_prompt || "");
      setHashtags(out.hashtags || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoadingGen(false);
    }
  };

  const onGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setError("Generate a post first (to get an image prompt).");
      return;
    }
    setError(null);
    setLoadingImg(true);
    setImageUrl(null);
    try {
      const url = await generateImage(imagePrompt);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setLoadingImg(false);
    }
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Clipboard not available");
    }
  };

  const postWithTags =
    post && hashtags.length
      ? `${post.trim()}\n\n${hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`
      : post;

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-2">
          <p className="text-sm font-medium text-sky-700 dark:text-sky-400">
            Assistive studio — you paste into LinkedIn yourself
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI LinkedIn content engine
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Backend:{" "}
            <code className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
              {base}
            </code>{" "}
            (LangChain + FastAPI). No database.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={onCheckLlm}
              disabled={loadingLlmCheck}
              className="w-fit rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {loadingLlmCheck ? "Checking chat model…" : "Test chat model (Gemini/OpenAI)"}
            </button>
            {llmHealth ? (
              <p
                className={`text-xs ${
                  llmHealth.ok
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-800 dark:text-amber-300"
                }`}
              >
                {llmHealth.ok
                  ? `OK · ${llmHealth.provider ?? "?"} · ${llmHealth.model ?? "?"} · “${llmHealth.reply_preview ?? ""}”`
                  : `Failed · ${llmHealth.provider ?? "?"} · ${llmHealth.error ?? "unknown"}`}
              </p>
            ) : null}
          </div>
        </header>

        {error ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            1 · Topics
          </h2>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Your topic (e.g. <em>AI can save jobs</em>, or <em>Gemma 4 open models</em>)
            <textarea
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none ring-sky-500/40 focus:border-sky-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              rows={2}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Flow: fetch trends from all sources, then in step 2 use{" "}
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              Keep topic-relevant (AI)
            </span>{" "}
            to trim the merged list. Optional: break the topic into angles first for richer search queries;
            skip that to search the raw topic only.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBreakTopic}
              disabled={loadingAngles}
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-950"
            >
              {loadingAngles ? "Breaking down topic…" : "Break topic into angles (AI)"}
            </button>
            {angles.length > 0 ? (
              <button
                type="button"
                onClick={clearAngles}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Clear AI angles
              </button>
            ) : null}
          </div>
          {angles.length > 0 ? (
            <div
              role="group"
              aria-label="Search angles"
              className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Search angles (select any)
                </span>
                <button
                  type="button"
                  onClick={selectAllAngles}
                  className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  Select all
                </button>
              </div>
              <ul className="space-y-2">
                {angles.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={!!selectedAngles[a.id]}
                        onChange={() => toggleAngle(a.id)}
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300"
                      />
                      <span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {a.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                          Search: {a.search_query}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onFetchTrends}
            disabled={loadingTrends}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            {loadingTrends ? "Fetching trends…" : "Fetch trends"}
          </button>
        </section>

        {items.length > 0 ? (
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                2 · Pick sources
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onAiFilterRelevance}
                  disabled={loadingFilter}
                  className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100 dark:hover:bg-sky-900/80"
                >
                  {loadingFilter ? "Filtering…" : "Keep topic-relevant (AI)"}
                </button>
                {hasAiFiltered && fullFetchedBackup ? (
                  <button
                    type="button"
                    onClick={onRestoreFullFetch}
                    className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                  >
                    Show all {fullFetchedBackup.length} fetched
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                >
                  Clear
                </button>
              </div>
            </div>
            {filterNote ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {filterNote}
              </p>
            ) : null}
            {filterUsedFallback ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Ranking used keyword overlap because the model returned no valid
                picks — try again or shorten the topic.
              </p>
            ) : null}
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {items.map((it, i) => (
                <li key={`${it.source}-${i}`}>
                  <label className="flex cursor-pointer gap-3 rounded-lg border border-zinc-100 p-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                    <input
                      type="checkbox"
                      checked={!!selected[i]}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {it.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                        {it.source}
                        {it.url ? (
                          <>
                            {" · "}
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                            >
                              link
                            </a>
                          </>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {it.summary}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-zinc-600 dark:text-zinc-400">
                Tone
                <select
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm text-zinc-600 dark:text-zinc-400">
              System prompt add-on (optional)
              <textarea
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Appended to the model’s system message: voice, never say X, always include Y, audience, compliance notes…"
              />
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                This shapes how the assistant behaves for every generate click. Use{" "}
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  Extra instructions
                </span>{" "}
                below for one-off tweaks for a single draft.
              </span>
            </label>
            <label className="block text-sm text-zinc-600 dark:text-zinc-400">
              Extra instructions (optional)
              <textarea
                className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                rows={2}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="e.g. Mention my newsletter, keep under 200 words…"
              />
            </label>
            <fieldset className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Output
              </legend>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="out-mode"
                  className="mt-1"
                  checked={includeImageIdeas}
                  onChange={() => setIncludeImageIdeas(true)}
                />
                <span>
                  Post + image prompt (then you can use{" "}
                  <strong className="font-medium">Generate image</strong> if you want a visual)
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="out-mode"
                  className="mt-1"
                  checked={!includeImageIdeas}
                  onChange={() => setIncludeImageIdeas(false)}
                />
                <span>LinkedIn post only — no image prompt, no image generation</span>
              </label>
            </fieldset>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loadingGen}
              className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {loadingGen ? "Generating with LangChain…" : "Generate LinkedIn draft"}
            </button>
          </section>
        ) : null}

        {post ? (
          <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              3 · Copy for LinkedIn
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText("post", postWithTags)}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
              >
                {copied === "post" ? "Copied" : "Copy post + hashtags"}
              </button>
              <button
                type="button"
                onClick={() => copyText("body", post)}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
              >
                {copied === "body" ? "Copied" : "Copy body only"}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {postWithTags}
            </pre>

            {generatedWithImageIdeas ? (
              <>
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Image prompt (from model)
                  </h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {imagePrompt}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText("img", imagePrompt)}
                      className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
                    >
                      {copied === "img" ? "Copied" : "Copy image prompt"}
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateImage}
                      disabled={loadingImg || !imagePrompt.trim()}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-60"
                    >
                      {loadingImg ? "Generating image…" : "Generate image"}
                    </button>
                  </div>
                </div>

                {imageUrl ? (
                  <div className="space-y-2">
                    <img
                      src={imageUrl}
                      alt="Generated visual for LinkedIn"
                      className="w-full max-w-lg rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                    <a
                      href={imageUrl}
                      download="linkedin-visual.png"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                    >
                      Open / save image
                    </a>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                You chose <strong className="font-medium">post only</strong> — no image prompt was generated. Switch
                output to “Post + image prompt” and run generate again if you want a visual.
              </p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
