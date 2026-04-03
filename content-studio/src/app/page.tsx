"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  apiBase,
  fetchTopicAngles,
  fetchTrends,
  filterTrendsForRelevance,
  generateImage,
  generatePost,
  type TopicAngle,
  type TrendItem,
} from "@/lib/api";

const TONE_OPTIONS = [
  "professional and concise",
  "technical peer-to-peer",
  "friendly and approachable",
  "thought-leader / opinionated",
] as const;

const btnPrimary =
  "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:from-sky-500 hover:to-indigo-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:from-sky-500 dark:to-indigo-600 dark:shadow-indigo-950/40 sm:px-5";

const btnDark =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500 sm:px-5";

const btnOutline =
  "inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border border-zinc-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:px-5";

const btnSoft =
  "inline-flex min-h-10 touch-manipulation items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200 dark:hover:bg-violet-900/50";

const inputClass =
  "mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-sky-400 dark:focus:ring-sky-400/20 sm:text-sm";

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-200";

function SectionCard({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm shadow-zinc-200/40 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:shadow-none sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white shadow-md shadow-sky-500/30"
          aria-hidden
        >
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

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
  const [includeImageIdeas, setIncludeImageIdeas] = useState(true);
  const [generatedWithImageIdeas, setGeneratedWithImageIdeas] = useState(true);
  const [angles, setAngles] = useState<TopicAngle[]>([]);
  const [selectedAngles, setSelectedAngles] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingAngles, setLoadingAngles] = useState(false);
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
      setError(
        "Enter a topic (at least 3 characters) before breaking it into angles."
      );
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
        "Select at least one angle below, or clear AI angles to search the raw topic only."
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
        system_prompt: systemPrompt.trim() || undefined,
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
    <div className="min-h-full bg-gradient-to-b from-sky-50/80 via-white to-indigo-50/40 text-zinc-900 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/40 dark:text-zinc-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 pb-16 sm:gap-8 sm:px-6 sm:py-10 lg:max-w-3xl">
        <header className="space-y-4 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
            Copy & paste only
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Turn trends into{" "}
            <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent dark:from-sky-400 dark:to-indigo-400">
              LinkedIn-ready
            </span>{" "}
            posts
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:mx-0">
            Pull signals from news & dev communities, trim what matters with AI,
            then draft in your voice. You stay in control of what goes live.
          </p>
          <details className="mx-auto max-w-xl rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 text-left text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 sm:mx-0">
            <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300">
              API connection (technical)
            </summary>
            <code className="mt-2 block break-all rounded-lg bg-zinc-100 px-2 py-1.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {base}
            </code>
          </details>
        </header>

        {error ? (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-100"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <SectionCard
          step={1}
          title="What are you posting about?"
          subtitle="Optional: break the topic into search angles, or go straight to fetching trends."
        >
          <label className={labelClass}>
            Your topic
            <textarea
              className={`${inputClass} min-h-[5.5rem] resize-y`}
              rows={3}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="e.g. AI augmenting jobs, not replacing them"
              autoComplete="off"
            />
          </label>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            After you fetch, use <strong className="font-medium text-zinc-700 dark:text-zinc-300">Keep topic-relevant</strong> in step 2 to drop noise from the merged feed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onBreakTopic}
              disabled={loadingAngles}
              className={btnSoft}
            >
              {loadingAngles ? "Breaking down…" : "Break topic into angles (AI)"}
            </button>
            {angles.length > 0 ? (
              <button
                type="button"
                onClick={clearAngles}
                className={btnOutline}
              >
                Clear angles
              </button>
            ) : null}
          </div>
          {angles.length > 0 ? (
            <div
              role="group"
              aria-label="Search angles"
              className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/40"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Search angles
                </span>
                <button
                  type="button"
                  onClick={selectAllAngles}
                  className="self-start text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  Select all
                </button>
              </div>
              <ul className="space-y-3">
                {angles.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer gap-3 rounded-xl border border-transparent p-2 hover:bg-white dark:hover:bg-zinc-900/80">
                      <input
                        type="checkbox"
                        checked={!!selectedAngles[a.id]}
                        onChange={() => toggleAngle(a.id)}
                        className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                          {a.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                          {a.search_query}
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
            className={`${btnDark} w-full sm:w-auto`}
          >
            {loadingTrends ? "Fetching trends…" : "Fetch trends"}
          </button>
        </SectionCard>

        {items.length > 0 ? (
          <SectionCard
            step={2}
            title="Pick sources & shape the draft"
            subtitle={`${items.length} item${items.length === 1 ? "" : "s"} · ${selectedItems.length} selected`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onAiFilterRelevance}
                disabled={loadingFilter}
                className={`${btnPrimary} w-full sm:w-auto`}
              >
                {loadingFilter ? "Filtering…" : "Keep topic-relevant (AI)"}
              </button>
              {hasAiFiltered && fullFetchedBackup ? (
                <button
                  type="button"
                  onClick={onRestoreFullFetch}
                  className="w-full text-center text-sm font-semibold text-zinc-600 underline-offset-2 hover:underline sm:w-auto dark:text-zinc-400"
                >
                  Show all {fullFetchedBackup.length} fetched
                </button>
              ) : null}
              <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
                <button
                  type="button"
                  onClick={selectAll}
                  className="min-h-11 flex-1 touch-manipulation rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-sky-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-sky-300 dark:hover:bg-zinc-700 sm:flex-none sm:px-4"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-11 flex-1 touch-manipulation rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:flex-none sm:px-4"
                >
                  Clear
                </button>
              </div>
            </div>
            {filterNote ? (
              <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
                {filterNote}
              </p>
            ) : null}
            {filterUsedFallback ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Keyword fallback was used — try filtering again or shorten your topic.
              </p>
            ) : null}
            <ul className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
              {items.map((it, i) => (
                <li key={`${it.source}-${i}`}>
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 transition hover:border-sky-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-800/30 dark:hover:border-sky-900 dark:hover:bg-zinc-800/60">
                    <input
                      type="checkbox"
                      checked={!!selected[i]}
                      onChange={() => toggle(i)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {it.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{it.source}</span>
                        {it.url ? (
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                          >
                            Open source
                          </a>
                        ) : null}
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {it.summary}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Tone
                <select
                  className={inputClass}
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
            <label className={labelClass}>
              System style (optional)
              <textarea
                className={`${inputClass} min-h-[5rem] resize-y`}
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Voice, audience, words to avoid, compliance — layered on the assistant’s system prompt"
              />
              <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Applies every time you generate. Use “Extra notes” below for one-off tweaks.
              </span>
            </label>
            <label className={labelClass}>
              Extra notes (optional)
              <textarea
                className={`${inputClass} min-h-[4rem] resize-y`}
                rows={2}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="e.g. plug my newsletter, stay under 200 words"
              />
            </label>
            <fieldset className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/30">
              <legend className="px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Output
              </legend>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="out-mode"
                  className="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500"
                  checked={includeImageIdeas}
                  onChange={() => setIncludeImageIdeas(true)}
                />
                <span>
                  Post + image prompt — then generate a visual if you want one
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="out-mode"
                  className="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500"
                  checked={!includeImageIdeas}
                  onChange={() => setIncludeImageIdeas(false)}
                />
                <span>LinkedIn text only — no image ideas</span>
              </label>
            </fieldset>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loadingGen}
              className={`${btnPrimary} w-full`}
            >
              {loadingGen ? "Drafting your post…" : "Generate LinkedIn draft"}
            </button>
          </SectionCard>
        ) : null}

        {post ? (
          <SectionCard
            step={3}
            title="Your draft"
            subtitle="Copy into LinkedIn when you’re happy with it."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => copyText("post", postWithTags)}
                className={`${btnOutline} w-full sm:w-auto`}
              >
                {copied === "post" ? "Copied ✓" : "Copy post + hashtags"}
              </button>
              <button
                type="button"
                onClick={() => copyText("body", post)}
                className={`${btnOutline} w-full sm:w-auto`}
              >
                {copied === "body" ? "Copied ✓" : "Copy body only"}
              </button>
            </div>
            <pre className="max-h-[min(24rem,50vh)] overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {postWithTags}
            </pre>

            {generatedWithImageIdeas ? (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Image prompt
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {imagePrompt}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => copyText("img", imagePrompt)}
                      className={`${btnOutline} w-full sm:w-auto`}
                    >
                      {copied === "img" ? "Copied ✓" : "Copy image prompt"}
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateImage}
                      disabled={loadingImg || !imagePrompt.trim()}
                      className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-5"
                    >
                      {loadingImg ? "Creating image…" : "Generate image"}
                    </button>
                  </div>
                </div>

                {imageUrl ? (
                  <div className="space-y-3">
                    <img
                      src={imageUrl}
                      alt="Generated visual for your post"
                      className="w-full max-w-lg rounded-xl border border-zinc-200 shadow-md dark:border-zinc-700"
                      loading="lazy"
                      decoding="async"
                    />
                    <a
                      href={imageUrl}
                      download="linkedin-visual.png"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Open or save image
                    </a>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You chose <strong className="text-zinc-700 dark:text-zinc-300">text only</strong>. Switch output to “Post + image prompt” and generate again if you want a visual.
              </p>
            )}
          </SectionCard>
        ) : null}
      </main>
    </div>
  );
}
