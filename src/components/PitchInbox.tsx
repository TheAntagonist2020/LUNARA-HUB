import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  LoaderCircle,
  MessageSquarePlus,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { timeAgo } from './newsreel/wire';

// Shapes mirror GET /api/dispatch/pitches (Lunara Dispatch 3.3.0 pitch gate),
// plus the hub's own `rank` (POST /api/dispatch/pitches/rank — a derived
// score cached locally; the pitch store itself lives on the site).
interface PitchRank {
  score: number;
  why: string;
  rankedAt: string;
  provider: string;
}

interface Pitch {
  id: string;
  status: 'pending' | 'approved' | 'written' | 'passed' | 'skipped';
  title: string;
  url: string;
  source: string;
  summary: string;
  image_url: string;
  published_at: string;
  angle: string;
  created_at: string;
  decided_at: string;
  note: string;
  postEditUrls: string[];
  rank: PitchRank | null;
}

type Call = 'write' | 'pass';
type View = 'all' | 'top' | 'stale';

// The site stores GMT as "Y-m-d H:i:s"; feeds send ISO.
const isoish = (value: string) => (!value ? null : value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
const stamp = (p: Pitch) => Date.parse(isoish(p.published_at) || isoish(p.created_at) || '') || 0;

// The site sends titles and summaries HTML-escaped (&#039;, &amp;).
const decodeEntities = (text: string) => {
  if (!text || !text.includes('&')) return text || '';
  const t = document.createElement('textarea');
  t.innerHTML = text;
  return t.value;
};

const STALE_DAYS = 7;
const TOP_SCORE = 70;
const PAGE = 40;
// The site's decide route takes at most 50 ids per call.
const DECIDE_CHUNK = 50;

const STATUS_LABEL: Record<Pitch['status'], string> = {
  pending: 'Waiting on you',
  approved: 'With the writer',
  written: 'Drafted',
  passed: 'Passed',
  skipped: 'Dispatch skipped it',
};

const scoreTone = (score: number) =>
  score >= 85
    ? 'border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10'
    : score >= TOP_SCORE
      ? 'border-zinc-300/60 text-zinc-200 bg-zinc-200/5'
      : score >= 40
        ? 'border-zinc-700 text-zinc-400'
        : 'border-zinc-800 text-zinc-600';

// Dispatch finds the stories; Dalton decides which become site drafts.
// Nothing here writes or publishes by itself — "Write it" hands the pitch to
// Dispatch, which drafts it (never publishes) into Awaiting Review below.
// "Rank" asks the model to read the backlog in Dalton's voice and score it,
// so a 400-pitch week sorts itself into the few worth his time.
export const PitchInbox: React.FC<{ panelClass: string; hairline: React.ReactNode; delay: number }> = ({
  panelClass,
  hairline,
  delay,
}) => {
  const [pitches, setPitches] = React.useState<Pitch[] | null>(null);
  const [pitchMode, setPitchMode] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [calls, setCalls] = React.useState<Record<string, Call>>({});
  const [angles, setAngles] = React.useState<Record<string, string>>({});
  const [angleOpen, setAngleOpen] = React.useState<Record<string, boolean>>({});
  const [sending, setSending] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [modeBusy, setModeBusy] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [view, setView] = React.useState<View>('all');
  const [shown, setShown] = React.useState(PAGE);
  const [ranking, setRanking] = React.useState<{ scored: number; left: number | null } | null>(null);
  const stopRanking = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/pitches');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Pitches unavailable (HTTP ${res.status})`);
      setPitches(data.pitches || []);
      setPitchMode(Boolean(data.pitchMode));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Pitches unavailable');
      setPitches(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const staleBefore = now - STALE_DAYS * 24 * 60 * 60 * 1000;
  const pending = React.useMemo(() => {
    const list = (pitches || []).filter((p) => p.status === 'pending');
    // Ranked first, best score up; ties and unranked by freshness.
    return list.sort((a, b) => {
      const ra = a.rank ? a.rank.score : -1;
      const rb = b.rank ? b.rank.score : -1;
      if (ra !== rb) return rb - ra;
      return stamp(b) - stamp(a);
    });
  }, [pitches]);
  const history = (pitches || []).filter((p) => p.status !== 'pending');
  const inFlight = history.filter((p) => p.status === 'approved').length;
  const ranked = pending.filter((p) => p.rank).length;
  const topPicks = pending.filter((p) => p.rank && p.rank.score >= TOP_SCORE);
  const stale = pending.filter((p) => stamp(p) && stamp(p) < staleBefore);

  const visible = view === 'top' ? topPicks : view === 'stale' ? stale : pending;
  const page = visible.slice(0, shown);

  const chosen = pending.filter((p) => calls[p.id]);
  const writeCount = chosen.filter((p) => calls[p.id] === 'write').length;

  React.useEffect(() => {
    setShown(PAGE);
  }, [view]);

  const toggle = (id: string, call: Call) =>
    setCalls((c) => {
      const next = { ...c };
      if (next[id] === call) delete next[id];
      else next[id] = call;
      return next;
    });

  // Mark a set of pitches as passes without touching calls already made.
  const passAll = (list: Pitch[]) =>
    setCalls((c) => ({ ...Object.fromEntries(list.map((p) => [p.id, 'pass' as Call])), ...c }));

  const send = async () => {
    if (!chosen.length || sending) return;
    setFlash(null);
    try {
      const write = chosen.filter((p) => calls[p.id] === 'write').map((p) => p.id);
      const pass = chosen.filter((p) => calls[p.id] === 'pass').map((p) => p.id);
      // The site takes 50 ids per call — one round trip per chunk, writes first
      // so the writer starts on the real picks before the passes clear.
      const batches: Array<{ write: string[]; pass: string[] }> = [];
      for (let i = 0; i < write.length; i += DECIDE_CHUNK) batches.push({ write: write.slice(i, i + DECIDE_CHUNK), pass: [] });
      for (let i = 0; i < pass.length; i += DECIDE_CHUNK) batches.push({ write: [], pass: pass.slice(i, i + DECIDE_CHUNK) });
      let approved = 0;
      let passed = 0;
      let writer: any = null;
      for (let i = 0; i < batches.length; i++) {
        setSending(batches.length > 1 ? `Sending ${i + 1} of ${batches.length}…` : 'Sending…');
        const res = await fetch('/api/dispatch/pitches/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...batches[i], angles }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        approved += data.approved || 0;
        passed += data.passed || 0;
        if (data.writer) writer = data.writer;
      }
      const parts = [];
      if (approved) parts.push(`${approved} going to the writer — drafts land in Awaiting Review in a few minutes`);
      if (passed) parts.push(`${passed} passed`);
      if (approved && writer && writer.queued === false && !writer.running) {
        parts.push(`the writer didn't start (${writer.message || 'unknown reason'}); the next scheduled run picks them up`);
      }
      setFlash(parts.join(' · ') || 'Nothing changed — those pitches were already decided.');
      setCalls({});
      setAngles({});
      setAngleOpen({});
      await load();
    } catch (err: any) {
      setFlash(err.message || 'The site did not take the calls.');
    } finally {
      setSending(null);
    }
  };

  // Score the backlog batch by batch until nothing pending is unranked (or
  // Dalton hits stop). Each batch is one model call; the list re-sorts as
  // scores land.
  const rank = async () => {
    if (ranking) return;
    stopRanking.current = false;
    setFlash(null);
    let scored = 0;
    setRanking({ scored, left: null });
    try {
      for (;;) {
        const res = await fetch('/api/dispatch/pitches/rank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        scored += data.ranked || 0;
        setRanking({ scored, left: data.remaining || 0 });
        await load();
        if (!data.remaining || stopRanking.current) break;
      }
      setFlash(scored ? `${scored} pitch${scored === 1 ? '' : 'es'} scored. Top picks are at the top; the rest can go.` : 'Everything pending is already scored.');
      if (scored) setView('top');
    } catch (err: any) {
      setFlash(err.message || 'Ranking failed.');
    } finally {
      setRanking(null);
    }
  };

  const setMode = async (enabled: boolean) => {
    setModeBusy(true);
    try {
      const res = await fetch('/api/dispatch/pitch-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setPitchMode(Boolean(data.pitchMode));
    } catch (err: any) {
      setFlash(err.message || 'Could not change pitch mode.');
    } finally {
      setModeBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.14em] transition-all disabled:opacity-30 ${
      active ? 'border-[#D4AF37]/60 text-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={`${panelClass} p-6 space-y-4`}
    >
      {hairline}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-serif italic text-zinc-100">Pitches</h2>
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">
            Dispatch finds the stories — you decide which become site drafts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pitchMode !== null && (
            <button
              role="switch"
              aria-checked={pitchMode}
              disabled={modeBusy}
              onClick={() => setMode(!pitchMode)}
              title={pitchMode ? 'Dispatch waits for your call before writing anything' : 'Dispatch writes drafts on its own'}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.14em] transition-all disabled:opacity-50 ${
                pitchMode ? 'border-[#D4AF37]/60 text-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-700 text-zinc-400'
              }`}
            >
              <span className={`w-6 h-3.5 rounded-full relative transition-colors ${pitchMode ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`}>
                <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-black transition-all ${pitchMode ? 'left-3' : 'left-0.5'}`} />
              </span>
              Pitch mode {pitchMode ? 'on' : 'off'}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh pitches"
            className="p-1.5 rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-zinc-400 font-mono leading-relaxed">{error}</p>}

      {pitches !== null && pitchMode === false && pending.length === 0 && (
        <p className="text-xs text-zinc-400 leading-relaxed">
          Pitch mode is off, so Dispatch writes drafts straight from the feeds. Turn it on and each run sends its finds
          here first — only the ones you pick get written.
        </p>
      )}
      {pitches !== null && pitchMode && pending.length === 0 && (
        <p className="text-xs text-zinc-400 leading-relaxed">
          No pitches waiting. The next Dispatch run will file what it finds here.
          {inFlight > 0 && ` ${inFlight} approved pitch${inFlight === 1 ? ' is' : 'es are'} with the writer.`}
        </p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setView('all')} className={chip(view === 'all')}>
            All {pending.length}
          </button>
          <button onClick={() => setView('top')} disabled={!ranked} className={chip(view === 'top')} title={ranked ? `Scored ${TOP_SCORE} or higher` : 'Rank first'}>
            Top picks {ranked ? topPicks.length : ''}
          </button>
          <button onClick={() => setView('stale')} disabled={!stale.length} className={chip(view === 'stale')} title={`Older than ${STALE_DAYS} days`}>
            Stale {stale.length}
          </button>
          <span className="flex-1" />
          {ranking ? (
            <button
              onClick={() => (stopRanking.current = true)}
              className="px-3 py-1 rounded-full border border-[#D4AF37]/60 text-[#D4AF37] bg-[#D4AF37]/10 text-[10px] font-mono uppercase tracking-[0.14em] flex items-center gap-1.5"
            >
              <LoaderCircle className="w-3 h-3 animate-spin" />
              {ranking.scored} scored{ranking.left !== null ? ` · ${ranking.left} left` : ''}
              <Square className="w-2.5 h-2.5 ml-1 fill-current" />
            </button>
          ) : (
            <button
              onClick={rank}
              disabled={ranked === pending.length}
              className={`${chip(false)} flex items-center gap-1.5 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10`}
              title={ranked === pending.length ? 'Every pending pitch is scored' : 'Score the backlog in your voice — Claude reads each pitch and says why'}
            >
              <Sparkles className="w-3 h-3" />
              {ranked ? `Rank ${pending.length - ranked} new` : 'Rank with Claude'}
            </button>
          )}
        </div>
      )}

      {pending.length > 0 && visible.length === 0 && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          {view === 'top' ? `Nothing scored ${TOP_SCORE} or higher yet.` : `Nothing older than ${STALE_DAYS} days.`}
        </p>
      )}

      {page.length > 0 && (
        <div className="space-y-2.5">
          {page.map((p) => {
            const call = calls[p.id];
            const when = timeAgo(isoish(p.published_at) || isoish(p.created_at));
            return (
              <div
                key={p.id}
                className={`p-3 rounded-lg border transition-all ${
                  call === 'write'
                    ? 'border-[#D4AF37]/70 bg-[#D4AF37]/[0.06]'
                    : call === 'pass'
                      ? 'border-zinc-800 bg-[#050505]/60 opacity-50'
                      : 'border-zinc-800/90 bg-[#050505]/80'
                }`}
              >
                <div className="flex gap-3">
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                      className="w-20 h-14 sm:w-24 sm:h-16 rounded object-cover border border-zinc-800 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                      {p.rank && (
                        <span
                          className={`px-1.5 py-0.5 rounded border font-bold tracking-normal ${scoreTone(p.rank.score)}`}
                          title={`Scored by ${p.rank.provider} ${timeAgo(p.rank.rankedAt)} ago`}
                        >
                          {p.rank.score}
                        </span>
                      )}
                      <span className="text-[#D4AF37]">{p.source || 'Source'}</span>
                      {when && <span>{when === 'just now' ? when : `${when} ago`}</span>}
                    </p>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm font-serif text-zinc-100 leading-snug hover:text-[#D4AF37]"
                    >
                      {decodeEntities(p.title)} <ArrowUpRight className="inline w-3 h-3 text-zinc-600" />
                    </a>
                    {p.rank?.why && <p className="text-[12px] text-amber-100/80 italic leading-relaxed">{p.rank.why}</p>}
                    {p.summary && <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">{decodeEntities(p.summary)}</p>}
                  </div>
                </div>

                {angleOpen[p.id] && (
                  <textarea
                    value={angles[p.id] || ''}
                    onChange={(e) => setAngles((a) => ({ ...a, [p.id]: e.target.value }))}
                    rows={2}
                    maxLength={600}
                    autoFocus
                    placeholder="Your angle for the writer — what's the real story here?"
                    aria-label={`Angle for ${decodeEntities(p.title)}`}
                    className="mt-2.5 w-full resize-none rounded-lg bg-black border border-zinc-800 focus:border-[#D4AF37]/60 focus:outline-none px-3 py-2 text-[12.5px] text-zinc-100 placeholder:text-zinc-600"
                  />
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.14em]">
                  <button
                    onClick={() => toggle(p.id, 'write')}
                    aria-pressed={call === 'write'}
                    className={`px-3 py-1.5 rounded-full border flex items-center gap-1 transition-all ${
                      call === 'write' ? 'bg-[#D4AF37] border-[#D4AF37] text-black font-bold' : 'border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10'
                    }`}
                  >
                    <PenLine className="w-3 h-3" /> Write it
                  </button>
                  <button
                    onClick={() => toggle(p.id, 'pass')}
                    aria-pressed={call === 'pass'}
                    className={`px-3 py-1.5 rounded-full border flex items-center gap-1 transition-all ${
                      call === 'pass' ? 'bg-zinc-200 border-zinc-200 text-black font-bold' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <X className="w-3 h-3" /> Pass
                  </button>
                  <button
                    onClick={() => {
                      setAngleOpen((o) => ({ ...o, [p.id]: !o[p.id] }));
                      if (!calls[p.id]) toggle(p.id, 'write');
                    }}
                    className={`px-3 py-1.5 rounded-full border flex items-center gap-1 ${
                      angles[p.id] ? 'border-[#D4AF37]/50 text-[#D4AF37]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    <MessageSquarePlus className="w-3 h-3" /> {angles[p.id] ? 'Angle added' : 'Add angle'}
                  </button>
                </div>
              </div>
            );
          })}
          {visible.length > shown && (
            <button
              onClick={() => setShown((s) => s + PAGE)}
              className="w-full py-2 rounded-lg border border-dashed border-zinc-800 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600"
            >
              Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown} left
            </button>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="sticky bottom-20 lg:bottom-4 z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur">
          <p className="text-[11px] text-zinc-400 pl-1">
            {sending
              ? sending
              : chosen.length
                ? `${writeCount} to write · ${chosen.length - writeCount} to pass`
                : `${pending.length} waiting — pick Write it or Pass`}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {stale.length > 0 && (
              <button
                onClick={() => passAll(stale)}
                disabled={Boolean(sending) || stale.every((p) => calls[p.id])}
                className="px-3 py-1.5 rounded-full border border-zinc-800 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                title={`Pass everything older than ${STALE_DAYS} days that you haven't marked`}
              >
                Pass stale ({stale.filter((p) => !calls[p.id]).length})
              </button>
            )}
            <button
              onClick={() => passAll(view === 'all' ? pending : visible)}
              disabled={Boolean(sending) || chosen.length === pending.length}
              className="px-3 py-1.5 rounded-full border border-zinc-800 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
              title={view === 'all' ? 'Mark every undecided pitch as a pass' : 'Mark every undecided pitch in this view as a pass'}
            >
              Pass the rest
            </button>
            <button
              onClick={send}
              disabled={!chosen.length || Boolean(sending)}
              className="px-4 py-1.5 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-[0.16em] flex items-center gap-1.5 disabled:opacity-30"
            >
              {sending ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send calls
            </button>
          </div>
        </div>
      )}

      {flash && <p className="text-[12px] text-amber-200/90 leading-relaxed">{flash}</p>}

      {history.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500 hover:text-zinc-200"
          >
            {showHistory ? 'Hide' : 'Show'} recent calls ({history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {history.slice(0, 12).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 text-[12px]">
                  <div className="min-w-0">
                    <p className="text-zinc-300 line-clamp-1">{decodeEntities(p.title)}</p>
                    {(p.note || p.angle) && (
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{p.note || `Angle: ${p.angle}`}</p>
                    )}
                  </div>
                  <span className="shrink-0 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.14em]">
                    {p.status === 'written' && p.postEditUrls[0] ? (
                      <a href={p.postEditUrls[0]} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline flex items-center gap-1">
                        <Check className="w-3 h-3" /> Drafted
                      </a>
                    ) : (
                      <span className={p.status === 'approved' ? 'text-[#D4AF37]' : 'text-zinc-500'}>{STATUS_LABEL[p.status]}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
  );
};
