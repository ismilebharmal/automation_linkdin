"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
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
  "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/30 transition hover:from-sky-500 hover:to-indigo-500 hover:shadow-sky-500/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:from-sky-500 dark:to-indigo-600 dark:shadow-indigo-950/50 sm:px-5";

const btnDark =
  "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-sky-600 dark:shadow-sky-900/30 dark:hover:bg-sky-500 sm:px-5";

const btnOutline =
  "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl border border-zinc-200/90 bg-white/95 px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800/95 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:px-5";

const btnSoft =
  "inline-flex min-h-10 touch-manipulation items-center justify-center gap-2 rounded-xl border border-violet-200/90 bg-violet-50/90 px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-200 dark:hover:bg-violet-900/60";

const inputClass =
  "mt-2 w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 py-3 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-sky-400 dark:focus:ring-sky-400/20 sm:text-sm";

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-200";

function SectionCard({
  step,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="animate-fade-rise rounded-2xl border border-zinc-200/70 bg-white/85 p-4 shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-700/70 dark:bg-zinc-900/80 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.55)] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 shadow-lg shadow-sky-500/35 ring-4 ring-sky-500/[0.12] dark:ring-sky-400/15">
          <Icon className="h-6 w-6 text-white" strokeWidth={2} aria-hidden />
          <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-white/30 bg-white px-1.5 text-[11px] font-bold text-sky-700 shadow-md dark:border-zinc-600 dark:bg-zinc-800 dark:text-sky-300">
            {step}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function HeroPill({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
      <Icon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
      {text}
    </span>
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
    <div className="mesh-page min-h-full text-zinc-900 dark:text-zinc-100">
      <main className="mx-auto flex max-w-2xl flex-col gap-7 px-4 py-6 pb-20 sm:gap-9 sm:px-6 sm:py-10 lg:max-w-3xl">
        <header className="animate-fade-rise space-y-5 text-center sm:text-left">
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <HeroPill icon={Search} text="Multi-source trends" />
            <HeroPill icon={Filter} text="AI relevance trim" />
            <HeroPill icon={Sparkles} text="Your voice, your paste" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            No auto-posting
          </p>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
            From what&apos;s trending to{" "}
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-indigo-400 dark:to-violet-400">
              LinkedIn-ready
            </span>{" "}
            posts
          </h1>
          <p className="mx-auto max-w-xl text-pretty text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:mx-0">
            Discover signals, filter the noise, generate a draft you can edit —
            then copy into LinkedIn when you&apos;re ready.
          </p>
          <details className="group mx-auto max-w-xl rounded-2xl border border-zinc-200/80 bg-white/60 px-4 py-3 text-left text-xs text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400 sm:mx-0">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
              API endpoint
            </summary>
            <code className="mt-3 block break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {base}
            </code>
          </details>
        </header>

        {error ? (
          <div
            className="animate-fade-rise flex gap-3 rounded-2xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-100"
            role="alert"
          >
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden
            />
            <span>{error}</span>
          </div>
        ) : null}

        <SectionCard
          step={1}
          icon={Search}
          title="What are you posting about?"
          subtitle="Optional AI angles for richer search — or fetch on your topic as-is."
        >
          <label className={labelClass}>
            Your topic
            <textarea
              className={`${inputClass} min-h-[5.5rem] resize-y`}
              rows={3}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="e.g. How AI is changing hiring for technical roles"
              autoComplete="off"
            />
          </label>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            After fetching, use{" "}
            <strong className="font-semibold text-zinc-700 dark:text-zinc-300">
              Keep topic-relevant
            </strong>{" "}
            in step 2 to focus the feed.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onBreakTopic}
              disabled={loadingAngles}
              className={btnSoft}
            >
              {loadingAngles ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden />
              )}
              {loadingAngles ? "Breaking down…" : "Break topic into angles"}
            </button>
            {angles.length > 0 ? (
              <button type="button" onClick={clearAngles} className={btnOutline}>
                Clear angles
              </button>
            ) : null}
          </div>
          {angles.length > 0 ? (
            <div
              role="group"
              aria-label="Search angles"
              className="space-y-3 rounded-2xl border border-zinc-100 bg-gradient-to-b from-zinc-50/90 to-white/50 p-4 dark:border-zinc-700 dark:from-zinc-800/50 dark:to-zinc-900/30"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
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
              <ul className="space-y-2">
                {angles.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-600 dark:hover:bg-zinc-900/80">
                      <input
                        type="checkbox"
                        checked={!!selectedAngles[a.id]}
                        onChange={() => toggleAngle(a.id)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 text-sky-600 focus:ring-sky-500"
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
            {loadingTrends ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Search className="h-4 w-4" aria-hidden />
            )}
            {loadingTrends ? "Fetching trends…" : "Fetch trends"}
          </button>
        </SectionCard>

        {items.length > 0 ? (
          <SectionCard
            step={2}
            icon={Layers}
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
                {loadingFilter ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Filter className="h-4 w-4" aria-hidden />
                )}
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
                  className="min-h-11 flex-1 touch-manipulation rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-sky-300 dark:hover:bg-zinc-700 sm:flex-none sm:px-4"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-11 flex-1 touch-manipulation rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:flex-none sm:px-4"
                >
                  Clear
                </button>
              </div>
            </div>
            {filterNote ? (
              <p className="flex gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{filterNote}</span>
              </p>
            ) : null}
            {filterUsedFallback ? (
              <p className="rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Keyword fallback was used — try filtering again or shorten your
                topic.
              </p>
            ) : null}
            <ul className="scroll-pretty max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
              {items.map((it, i) => (
                <li key={`${it.source}-${i}`}>
                  <label className="flex cursor-pointer gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3.5 transition hover:border-sky-200/80 hover:bg-white hover:shadow-md hover:shadow-sky-500/5 dark:border-zinc-800 dark:bg-zinc-800/40 dark:hover:border-sky-800 dark:hover:bg-zinc-800/70">
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
                            className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline dark:text-sky-400"
                          >
                            Open
                            <ExternalLink className="h-3 w-3" aria-hidden />
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
                placeholder="Voice, audience, words to avoid, compliance"
              />
              <span className="mt-1.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Applies on every generate. Use extra notes for one-off tweaks.
              </span>
            </label>
            <label className={labelClass}>
              Extra notes (optional)
              <textarea
                className={`${inputClass} min-h-[4rem] resize-y`}
                rows={2}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="e.g. mention my newsletter, keep under 200 words"
              />
            </label>
            <fieldset className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
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
                <span className="flex items-start gap-2">
                  <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                  Post + image prompt — optional visual after
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
                <span>LinkedIn text only</span>
              </label>
            </fieldset>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loadingGen}
              className={`${btnPrimary} w-full`}
            >
              {loadingGen ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {loadingGen ? "Drafting…" : "Generate LinkedIn draft"}
            </button>
          </SectionCard>
        ) : null}

        {post ? (
          <SectionCard
            step={3}
            icon={Sparkles}
            title="Your draft"
            subtitle="Copy when you’re happy — edit in LinkedIn anytime."
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => copyText("post", postWithTags)}
                className={`${btnOutline} w-full sm:w-auto`}
              >
                {copied === "post" ? (
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied === "post" ? "Copied" : "Copy post + hashtags"}
              </button>
              <button
                type="button"
                onClick={() => copyText("body", post)}
                className={`${btnOutline} w-full sm:w-auto`}
              >
                {copied === "body" ? (
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied === "body" ? "Copied" : "Copy body only"}
              </button>
            </div>
            <pre className="scroll-pretty max-h-[min(24rem,50vh)] overflow-auto whitespace-pre-wrap rounded-2xl border border-zinc-100 bg-zinc-50/90 p-4 font-sans text-sm leading-relaxed text-zinc-800 shadow-inner dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {postWithTags}
            </pre>

            {generatedWithImageIdeas ? (
              <>
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <ImageIcon className="h-4 w-4" aria-hidden />
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
                      {copied === "img" ? (
                        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                      {copied === "img" ? "Copied" : "Copy image prompt"}
                    </button>
                    <button
                      type="button"
                      onClick={onGenerateImage}
                      disabled={loadingImg || !imagePrompt.trim()}
                      className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-5"
                    >
                      {loadingImg ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <ImageIcon className="h-4 w-4" aria-hidden />
                      )}
                      {loadingImg ? "Creating…" : "Generate image"}
                    </button>
                  </div>
                </div>

                {imageUrl ? (
                  <div className="space-y-3">
                    <img
                      src={imageUrl}
                      alt="Generated visual for your post"
                      className="w-full max-w-lg rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-500/10 dark:border-zinc-700 dark:shadow-black/40"
                      loading="lazy"
                      decoding="async"
                    />
                    <a
                      href={imageUrl}
                      download="linkedin-visual.png"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Open or save image
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You chose <strong className="text-zinc-800 dark:text-zinc-200">text only</strong>.
                Switch output to “Post + image prompt” and generate again for a visual.
              </p>
            )}
          </SectionCard>
        ) : null}
      </main>
    </div>
  );
}
