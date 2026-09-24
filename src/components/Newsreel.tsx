import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import {
  ArrowUpRight,
  Clapperboard,
  Flame,
  LoaderCircle,
  RefreshCw,
  Scissors,
  Star,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { HotTake, NewsCategory, NewsStory, Spice, WireSourceStatus } from '../types';
import { StoryCard, StoryCardHandle, StoryImage } from './newsreel/StoryCard';
import { StoryDetail } from './newsreel/StoryDetail';
import { DispatchIntegrations } from './newsreel/DispatchPanel';
import { CATEGORY_META, CATEGORY_ORDER, loadJson, saveJson, showtime, timeAgo } from './newsreel/wire';

const SEEN_KEY = 'lunara_newsreel_seen';
const SAVED_KEY = 'lunara_newsreel_saved';
const TAKES_KEY = 'lunara_newsreel_takes';
const PREFS_KEY = 'lunara_newsreel_prefs';

interface Prefs {
  category: 'all' | NewsCategory;
  spice: Spice;
  hintDismissed: boolean;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const ControlButton: React.FC<{
  label: string;
  caption: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: 'plain' | 'cut' | 'print' | 'take';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}> = ({ label, caption, onClick, href, disabled, tone = 'plain', size = 'md', children }) => {
  const dims = size === 'lg' ? 'w-[3.75rem] h-[3.75rem] sm:w-16 sm:h-16' : size === 'md' ? 'w-[3.25rem] h-[3.25rem] sm:w-14 sm:h-14' : 'w-10 h-10 sm:w-11 sm:h-11';
  const tones = {
    plain: 'border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600',
    cut: 'border-rose-400/40 text-rose-300 hover:bg-rose-500/10 hover:border-rose-400',
    print: 'border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]',
    take: 'border-[#D4AF37] bg-[#D4AF37] text-black shadow-[0_0_32px_rgba(212,175,55,0.35)] hover:bg-[#e8c85a]',
  }[tone];
  const inner = (
    <span className={`${dims} rounded-full border flex items-center justify-center transition-all active:scale-95 ${tones}`}>
      {children}
    </span>
  );
  return (
    <div className="flex flex-col items-center gap-1">
      {href && !disabled ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label}>
          {inner}
        </a>
      ) : (
        <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="disabled:opacity-30 disabled:pointer-events-none">
          {inner}
        </button>
      )}
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-600">{caption}</span>
    </div>
  );
};

export const Newsreel: React.FC = () => {
  const [stories, setStories] = useState<NewsStory[] | null>(null);
  const [sources, setSources] = useState<WireSourceStatus[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [tmdbOn, setTmdbOn] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshReel, setFreshReel] = useState<{ stories: NewsStory[]; sources: WireSourceStatus[]; fetchedAt: string } | null>(null);

  const [prefs, setPrefs] = useState<Prefs>(() => ({
    category: 'all',
    spice: 'hot',
    hintDismissed: false,
    ...loadJson<Partial<Prefs>>(PREFS_KEY, {}),
  }));
  useEffect(() => saveJson(PREFS_KEY, prefs), [prefs]);
  const { category, spice } = prefs;

  const [seen, setSeen] = useState<string[]>(() => loadJson(SEEN_KEY, [] as string[]));
  const [saved, setSaved] = useState<NewsStory[]>(() => loadJson(SAVED_KEY, [] as NewsStory[]));
  const [takes, setTakes] = useState<Record<string, HotTake>>(() => loadJson(TAKES_KEY, {} as Record<string, HotTake>));
  useEffect(() => saveJson(SEEN_KEY, seen.slice(-600)), [seen]);
  useEffect(() => saveJson(SAVED_KEY, saved.slice(0, 100)), [saved]);
  useEffect(() => saveJson(TAKES_KEY, Object.fromEntries(Object.entries(takes).slice(-120))), [takes]);

  const [history, setHistory] = useState<Array<{ id: string; dir: 1 | -1 }>>([]);
  const [enterFrom, setEnterFrom] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [takeLoading, setTakeLoading] = useState<Record<string, boolean>>({});
  const [takeError, setTakeError] = useState<Record<string, string | null>>({});

  const [view, setView] = useState<'deck' | 'shortlist'>('deck');
  const [sheetStory, setSheetStory] = useState<NewsStory | null>(null);
  const [pinned, setPinned] = useState<NewsStory | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [integrations, setIntegrations] = useState<DispatchIntegrations | null>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const topRef = useRef<StoryCardHandle>(null);
  const sheetDrag = useDragControls();
  const marquee = showtime();

  // ── Data ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news/feed${refresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setStories(data.stories);
      setSources(data.sources);
      setFetchedAt(data.fetchedAt);
      setTmdbOn(Boolean(data.enrichment?.tmdb));
      setPending(data.enrichment?.pending || 0);
      setFreshReel(null);
    } catch (err: any) {
      setError(err.message || 'The wire is down.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => setIntegrations({ typefully: Boolean(h?.integrations?.typefullyKey), buffer: Boolean(h?.integrations?.bufferKey) }))
      .catch(() => setIntegrations(null));
  }, [load]);

  // Art and trailers keep arriving for a few seconds after first load — fold
  // them into the cards already dealt, without reshuffling the deck.
  useEffect(() => {
    if (!fetchedAt || !pending) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (cancelled || tries++ >= 8) return;
      try {
        const data = await (await fetch('/api/news/feed?wait=0')).json();
        if (cancelled || !Array.isArray(data.stories)) return;
        const byId = new Map<string, NewsStory>(data.stories.map((s: NewsStory) => [s.id, s]));
        setStories((prev) =>
          prev
            ? prev.map((s) => {
                const f = byId.get(s.id);
                return f ? { ...s, image: f.image, film: f.film, trailer: f.trailer, coverage: f.coverage } : s;
              })
            : prev
        );
        setPending(data.enrichment?.pending || 0);
        if (data.enrichment?.pending) timer = setTimeout(tick, 5000);
      } catch {
        // keep the cards we have
      }
    };
    timer = setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedAt]);

  // Every 10 minutes, peek at the wire; new stories wait behind a pill
  // instead of sliding under your thumb.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const data = await (await fetch('/api/news/feed?wait=0')).json();
        if (!Array.isArray(data.stories) || data.fetchedAt === fetchedAt) return;
        setFreshReel({ stories: data.stories, sources: data.sources, fetchedAt: data.fetchedAt });
      } catch {
        // offline for a moment — try again next interval
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  const seenSet = useMemo(() => new Set(seen), [seen]);
  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const deck = useMemo(
    () => (stories || []).filter((s) => (category === 'all' || s.category === category) && !seenSet.has(s.id)),
    [stories, category, seenSet]
  );
  const top = deck[0] || null;
  const visible = deck.slice(0, 3);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const s of stories || []) {
      if (seenSet.has(s.id)) continue;
      c.all++;
      c[s.category] = (c[s.category] || 0) + 1;
    }
    return c;
  }, [stories, seenSet]);
  const freshCount = useMemo(() => {
    if (!freshReel || !stories) return 0;
    const known = new Set(stories.map((s) => s.id));
    return freshReel.stories.filter((s) => !known.has(s.id)).length;
  }, [freshReel, stories]);
  const liveSources = sources.filter((s) => s.ok).length;

  // ── Actions ───────────────────────────────────────────────────────────────
  const setCategory = (c: 'all' | NewsCategory) => setPrefs((p) => ({ ...p, category: c }));
  const setSpice = (s: Spice) => setPrefs((p) => ({ ...p, spice: s }));

  const decide = useCallback((story: NewsStory, dir: 1 | -1) => {
    setSeen((prev) => [...prev.filter((id) => id !== story.id), story.id]);
    setHistory((prev) => [...prev.slice(-49), { id: story.id, dir }]);
    if (dir === 1) setSaved((prev) => (prev.some((s) => s.id === story.id) ? prev : [story, ...prev]));
    setEnterFrom(null);
    setPinned(null);
    setPrefs((p) => (p.hintDismissed ? p : { ...p, hintDismissed: true }));
  }, []);

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setSeen((prev) => prev.filter((id) => id !== last.id));
    if (last.dir === 1) setSaved((prev) => prev.filter((s) => s.id !== last.id));
    const story = stories?.find((s) => s.id === last.id);
    if (story && category !== 'all' && story.category !== category) setCategory('all');
    setEnterFrom(last);
    setTimeout(() => setEnterFrom((cur) => (cur === last ? null : cur)), 800);
    setView('deck');
  }, [history, stories, category]);

  const getTake = useCallback(
    async (story: NewsStory, regenerate = false) => {
      setTakeLoading((p) => ({ ...p, [story.id]: true }));
      setTakeError((p) => ({ ...p, [story.id]: null }));
      try {
        const res = await fetch('/api/news/take', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: story.id,
            spice,
            regenerate,
            story: { title: story.title, source: story.source, summary: story.summary, category: story.category, film: story.film },
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        setTakes((p) => ({ ...p, [story.id]: { ...data.data, provider: data.provider, spice } }));
      } catch (err: any) {
        setTakeError((p) => ({ ...p, [story.id]: err.message || 'No take this time.' }));
      } finally {
        setTakeLoading((p) => ({ ...p, [story.id]: false }));
      }
    },
    [spice]
  );

  // Opening a story is intent — the take starts writing right away.
  const openStory = useCallback(
    (story: NewsStory, pin = false) => {
      if (isDesktop) {
        if (pin) setPinned(story);
      } else {
        setSheetStory(story);
      }
      if (!takes[story.id] && !takeLoading[story.id]) getTake(story);
    },
    [isDesktop, takes, takeLoading, getTake]
  );

  const toggleSave = (story: NewsStory) =>
    setSaved((prev) => (prev.some((s) => s.id === story.id) ? prev.filter((s) => s.id !== story.id) : [story, ...prev]));

  const rewind = () => {
    const ids = new Set((stories || []).filter((s) => category === 'all' || s.category === category).map((s) => s.id));
    setSeen((prev) => prev.filter((id) => !ids.has(id)));
    setHistory([]);
  };

  const applyFreshReel = () => {
    if (!freshReel) return;
    setStories(freshReel.stories);
    setSources(freshReel.sources);
    setFetchedAt(freshReel.fetchedAt);
    setFreshReel(null);
  };

  // Keyboard: ← cut · → print · ↑/Enter open · Z/Backspace undo · T take
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (t?.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (sheetStory) {
        if (e.key === 'Escape') setSheetStory(null);
        return;
      }
      if (view !== 'deck') return;
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        topRef.current?.fling(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        topRef.current?.fling(1);
      } else if ((e.key === 'ArrowUp' || e.key === 'Enter') && top) {
        e.preventDefault();
        openStory(top);
      } else if (e.key === 'Backspace' || key === 'z') {
        e.preventDefault();
        undo();
      } else if (key === 't' && top) {
        getTake(top, Boolean(takes[top.id] && takes[top.id].spice === spice));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetStory, view, top, openStory, undo, getTake, takes, spice]);

  // Lock the page behind the mobile sheet.
  useEffect(() => {
    if (!sheetStory) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetStory]);

  const panelStory = pinned || (view === 'deck' ? top : saved[0] || null);

  const detailFor = (story: NewsStory) => (
    <StoryDetail
      story={story}
      take={takes[story.id] || null}
      takeLoading={Boolean(takeLoading[story.id])}
      takeError={takeError[story.id] || null}
      spice={spice}
      onSpice={setSpice}
      onGetTake={(regenerate) => getTake(story, regenerate)}
      saved={savedIds.has(story.id)}
      onToggleSave={() => toggleSave(story)}
      integrations={integrations}
    />
  );

  const chips: Array<'all' | NewsCategory> = ['all', ...CATEGORY_ORDER.filter((c) => counts[c] || c === category)];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="lg:grid lg:grid-cols-[minmax(340px,430px)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
      <section className="newsreel-stage flex flex-col gap-2.5 sm:gap-4 min-w-0">
        {/* Marquee */}
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#D4AF37] flex items-center gap-2 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)] shrink-0" />
            Newsreel<span className="hidden sm:inline"> · {marquee.kicker}</span>
          </p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif italic text-[2rem] sm:text-4xl leading-tight bg-gradient-to-r from-[#e8d5a0] via-[#D4AF37] to-[#a8862e] bg-clip-text text-transparent pb-0.5 truncate">
              {marquee.title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setView((v) => (v === 'deck' ? 'shortlist' : 'deck'))}
                aria-pressed={view === 'shortlist'}
                aria-label={view === 'shortlist' ? 'Back to the reel' : `Shortlist, ${saved.length} saved`}
                className={`h-9 px-3 rounded-full border text-[10px] font-mono uppercase tracking-[0.16em] flex items-center gap-1.5 transition-all ${
                  view === 'shortlist' ? 'border-[#D4AF37] bg-[#D4AF37] text-black' : 'border-zinc-800 text-zinc-300 hover:border-[#D4AF37]/60'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${view === 'shortlist' ? 'fill-black' : ''}`} />
                <span className="hidden sm:inline lg:hidden">{view === 'shortlist' ? 'Back to reel' : 'Shortlist'}</span>
                {view !== 'shortlist' && saved.length > 0 && <span>{saved.length}</span>}
              </button>
              <button
                onClick={() => load(true)}
                disabled={loading}
                aria-label="Check the wire for new stories"
                title="Check the wire"
                className="w-9 h-9 rounded-full border border-zinc-800 text-zinc-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/60 flex items-center justify-center transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowSources((v) => !v)}
            className="-mt-1 sm:mt-0 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300 text-left"
            aria-expanded={showSources}
          >
            {stories ? `${counts.all} on the wire` : 'Tuning in'}
            {sources.length > 0 && ` · ${liveSources}/${sources.length} sources`}
            {fetchedAt && ` · ${new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </button>
        </div>

        {showSources && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0a0a0a] p-3 text-[11px] space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {sources.map((s) => (
                <p key={`${s.kind}-${s.id}`} className="flex items-center gap-1.5 min-w-0" title={s.error || `${s.count} stories`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className={`truncate ${s.ok ? 'text-zinc-300' : 'text-zinc-500'}`}>{s.label}</span>
                  <span className="text-zinc-600 font-mono text-[9px] shrink-0">{s.ok ? s.count : s.error}</span>
                </p>
              ))}
            </div>
            <p className="text-zinc-500 leading-relaxed">
              Trades + official studio channels, all free. {tmdbOn === false && 'Official key art and trailers via TMDB are off — add a free TMDB_API_KEY to .env to turn them on. '}
              The wire reads only; site drafts stay with Lunara Dispatch.
            </p>
          </div>
        )}

        {view === 'deck' ? (
          <>
            {/* Category chips */}
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-1.5 overflow-x-auto scrollbar-none shrink-0" role="tablist" aria-label="Filter the wire">
              {chips.map((c) => {
                const on = category === c;
                const n = counts[c] || 0;
                return (
                  <button
                    key={c}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setCategory(c)}
                    className={`shrink-0 px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-[0.16em] transition-all ${
                      on ? 'border-[#D4AF37] text-black bg-[#D4AF37]' : 'border-zinc-800 text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {c === 'all' ? 'All' : CATEGORY_META[c].chip}
                    <span className={on ? 'text-black/60' : 'text-zinc-600'}> {n}</span>
                  </button>
                );
              })}
            </div>

            {/* The deck */}
            <div className="relative flex-1 min-h-0">
              {freshCount > 0 && (
                <button
                  onClick={applyFreshReel}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-[0.16em] shadow-[0_8px_30px_rgba(212,175,55,0.35)]"
                >
                  ↑ {freshCount} fresh off the wire
                </button>
              )}

              {loading && !stories && (
                <div className="absolute inset-0 rounded-[28px] border border-zinc-800 bg-[#0a0a0a] overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-[62%] bg-gradient-to-br from-zinc-900 to-[#0a0a0a] animate-pulse" />
                  <div className="absolute inset-x-0 bottom-0 p-6 space-y-3">
                    <div className="h-7 w-5/6 rounded bg-zinc-900 animate-pulse" />
                    <div className="h-7 w-2/3 rounded bg-zinc-900 animate-pulse" />
                    <p className="pt-2 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 flex items-center gap-2">
                      <LoaderCircle className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" /> Threading the projector…
                    </p>
                  </div>
                </div>
              )}

              {error && !stories && (
                <div className="absolute inset-0 rounded-[28px] border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-8 gap-3">
                  <Clapperboard className="w-9 h-9 text-rose-300/70" />
                  <h2 className="font-serif italic text-3xl text-zinc-100">The projector jammed.</h2>
                  <p className="text-xs text-zinc-500 font-mono max-w-xs">{error}</p>
                  <button onClick={() => load()} className="mt-2 px-5 py-2 rounded-full border border-[#D4AF37] text-[#D4AF37] text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#D4AF37] hover:text-black transition-all">
                    Try again
                  </button>
                </div>
              )}

              {stories && stories.length === 0 && (
                <div className="absolute inset-0 rounded-[28px] border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-8 gap-3">
                  <Clapperboard className="w-9 h-9 text-zinc-600" />
                  <h2 className="font-serif italic text-3xl text-zinc-100">No signal from the trades.</h2>
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                    None of the {sources.length} sources answered. Check the connection, then give the wire another go.
                  </p>
                  <button onClick={() => setShowSources(true)} className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 underline underline-offset-4">
                    See source status
                  </button>
                </div>
              )}

              {stories && stories.length > 0 && !top && (
                <div className="absolute inset-0 rounded-[28px] border border-dashed border-zinc-800 bg-gradient-to-b from-[#D4AF37]/[0.04] to-transparent flex flex-col items-center justify-center text-center p-8 gap-3">
                  <Clapperboard className="w-10 h-10 text-[#D4AF37]/70" />
                  <h2 className="font-serif italic text-[2rem] leading-tight text-zinc-100">That's a wrap on the wire.</h2>
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                    You've cut or printed every {category === 'all' ? '' : `${CATEGORY_META[category].chip.toLowerCase()} `}story. Fresh
                    reels land every few minutes.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button onClick={rewind} className="px-4 py-2 rounded-full border border-zinc-700 text-zinc-300 text-[10px] font-mono uppercase tracking-[0.18em] hover:border-zinc-500">
                      Rewind the reel
                    </button>
                    <button onClick={() => load(true)} className="px-4 py-2 rounded-full border border-[#D4AF37] text-[#D4AF37] text-[10px] font-bold uppercase tracking-[0.18em] hover:bg-[#D4AF37] hover:text-black transition-all">
                      Check the wire
                    </button>
                    {saved.length > 0 && (
                      <button onClick={() => setView('shortlist')} className="px-4 py-2 rounded-full border border-zinc-700 text-zinc-300 text-[10px] font-mono uppercase tracking-[0.18em] hover:border-zinc-500">
                        Shortlist · {saved.length}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!prefs.hintDismissed && top && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 whitespace-nowrap pl-3.5 pr-2 py-1.5 rounded-full bg-black/85 backdrop-blur border border-zinc-800 text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-400">
                  <span>→ Print it · ← Cut it · Tap for the take</span>
                  <button onClick={() => setPrefs((p) => ({ ...p, hintDismissed: true }))} aria-label="Dismiss hint" className="p-0.5 text-zinc-600 hover:text-zinc-200">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {visible
                .slice()
                .reverse()
                .map((s, i) => {
                  const depth = visible.length - 1 - i;
                  return (
                    <StoryCard
                      key={s.id}
                      ref={depth === 0 ? topRef : undefined}
                      story={s}
                      take={takes[s.id] || null}
                      depth={depth}
                      enterFrom={enterFrom?.id === s.id ? enterFrom.dir : 0}
                      onDecide={(dir) => decide(s, dir)}
                      onOpen={() => openStory(s)}
                    />
                  );
                })}
            </div>

            {/* Controls */}
            <div className="flex items-end justify-center gap-3 sm:gap-5 shrink-0 pt-1">
              <ControlButton label="Undo last swipe" caption="Undo" size="sm" onClick={undo} disabled={!history.length}>
                <Undo2 className="w-4 h-4" />
              </ControlButton>
              <ControlButton label="Cut — pass on this story" caption="Cut" tone="cut" onClick={() => topRef.current?.fling(-1)} disabled={!top}>
                <Scissors className="w-5 h-5" />
              </ControlButton>
              <ControlButton label="Get the hot take" caption="Take" tone="take" size="lg" onClick={() => top && openStory(top, true)} disabled={!top}>
                <Flame className="w-6 h-6" />
              </ControlButton>
              <ControlButton label="Print it — save to the shortlist" caption="Print" tone="print" onClick={() => topRef.current?.fling(1)} disabled={!top}>
                <Star className="w-5 h-5" />
              </ControlButton>
              <ControlButton label="Open the original story" caption="Source" size="sm" href={top?.url} disabled={!top}>
                <ArrowUpRight className="w-4 h-4" />
              </ControlButton>
            </div>
          </>
        ) : (
          /* Shortlist */
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-2.5">
            {saved.length === 0 && (
              <div className="h-full min-h-[320px] rounded-[28px] border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-8 gap-3">
                <Star className="w-9 h-9 text-[#D4AF37]/60" />
                <h2 className="font-serif italic text-3xl text-zinc-100">Nothing printed yet.</h2>
                <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                  Swipe right on a story and it lands here — your shortlist for the social desk.
                </p>
              </div>
            )}
            {saved.map((s) => (
              <div
                key={s.id}
                className={`group flex gap-3 p-2.5 rounded-2xl border bg-[#0a0a0a] transition-all ${
                  panelStory?.id === s.id && isDesktop ? 'border-[#D4AF37]/60' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <button onClick={() => openStory(s, true)} className="flex gap-3 flex-1 min-w-0 text-left">
                  <div className="w-24 h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
                    <StoryImage story={s} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#D4AF37]">
                      {CATEGORY_META[s.category].label}
                      <span className="text-zinc-600"> · {s.source}{s.publishedAt ? ` · ${timeAgo(s.publishedAt)}` : ''}</span>
                      {takes[s.id] && <Flame className="inline w-3 h-3 ml-1.5 -mt-0.5 text-[#D4AF37]" />}
                    </p>
                    <p className="font-serif text-[15px] leading-snug text-zinc-100 line-clamp-2">{s.title}</p>
                  </div>
                </button>
                <button
                  onClick={() => toggleSave(s)}
                  aria-label={`Remove “${s.title}” from the shortlist`}
                  className="self-center p-2 rounded-full text-zinc-600 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Desktop: the story on top of the deck, fully opened */}
      <aside className="hidden lg:block min-w-0">
        <div className="sticky top-24 max-h-[calc(100dvh-7.5rem)] overflow-y-auto pr-2 -mr-2 pb-6">
          {panelStory ? (
            detailFor(panelStory)
          ) : (
            <div className="h-[60vh] rounded-3xl border border-dashed border-zinc-800 flex items-center justify-center text-center p-10">
              <p className="font-serif italic text-2xl text-zinc-500">The screen's dark. Pull a story onto it.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile: bottom sheet */}
      <AnimatePresence>
        {sheetStory && !isDesktop && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetStory(null)}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={sheetStory.title}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 340 }}
              drag="y"
              dragListener={false}
              dragControls={sheetDrag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.8 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 700) setSheetStory(null);
              }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] flex flex-col rounded-t-[28px] bg-[#0a0a0a] border-t border-zinc-800 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
            >
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
              <div onPointerDown={(e) => sheetDrag.start(e)} className="shrink-0 pt-3 pb-3 flex justify-center cursor-grab touch-none">
                <span className="w-12 h-1.5 rounded-full bg-zinc-700" />
              </div>
              <button
                onClick={() => setSheetStory(null)}
                aria-label="Close"
                className="absolute top-2.5 right-3 p-2 rounded-full text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                {detailFor(sheetStory)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
