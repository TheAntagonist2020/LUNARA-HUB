import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Check, LoaderCircle, MessageSquarePlus, PenLine, RefreshCw, Send, X } from 'lucide-react';
import { timeAgo } from './newsreel/wire';

// Shapes mirror GET /api/dispatch/pitches (Lunara Dispatch 3.3.0 pitch gate).
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
}

type Call = 'write' | 'pass';

// The site stores GMT as "Y-m-d H:i:s"; feeds send ISO.
const isoish = (value: string) => (!value ? null : value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);

const STATUS_LABEL: Record<Pitch['status'], string> = {
  pending: 'Waiting on you',
  approved: 'With the writer',
  written: 'Drafted',
  passed: 'Passed',
  skipped: 'Dispatch skipped it',
};

// Dispatch finds the stories; Dalton decides which become site drafts.
// Nothing here writes or publishes by itself — "Write it" hands the pitch to
// Dispatch, which drafts it (never publishes) into Awaiting Review below.
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
  const [sending, setSending] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [modeBusy, setModeBusy] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

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

  const pending = (pitches || []).filter((p) => p.status === 'pending');
  const history = (pitches || []).filter((p) => p.status !== 'pending');
  const inFlight = history.filter((p) => p.status === 'approved').length;
  const chosen = pending.filter((p) => calls[p.id]);
  const writeCount = chosen.filter((p) => calls[p.id] === 'write').length;

  const toggle = (id: string, call: Call) =>
    setCalls((c) => {
      const next = { ...c };
      if (next[id] === call) delete next[id];
      else next[id] = call;
      return next;
    });

  const send = async () => {
    if (!chosen.length || sending) return;
    setSending(true);
    setFlash(null);
    try {
      const write = chosen.filter((p) => calls[p.id] === 'write').map((p) => p.id);
      const pass = chosen.filter((p) => calls[p.id] === 'pass').map((p) => p.id);
      const res = await fetch('/api/dispatch/pitches/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ write, pass, angles }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const parts = [];
      if (data.approved) parts.push(`${data.approved} going to the writer — drafts land in Awaiting Review in a few minutes`);
      if (data.passed) parts.push(`${data.passed} passed`);
      if (data.approved && data.writer && data.writer.queued === false && !data.writer.running) {
        parts.push(`the writer didn't start (${data.writer.message || 'unknown reason'}); the next scheduled run picks them up`);
      }
      setFlash(parts.join(' · ') || 'Nothing changed — those pitches were already decided.');
      setCalls({});
      setAngles({});
      setAngleOpen({});
      await load();
    } catch (err: any) {
      setFlash(err.message || 'The site did not take the calls.');
    } finally {
      setSending(false);
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
        <div className="space-y-2.5">
          {pending.map((p) => {
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
                    <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                      <span className="text-[#D4AF37]">{p.source || 'Source'}</span>
                      {when && ` · ${when}${when === 'just now' ? '' : ' ago'}`}
                    </p>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm font-serif text-zinc-100 leading-snug hover:text-[#D4AF37]"
                    >
                      {p.title} <ArrowUpRight className="inline w-3 h-3 text-zinc-600" />
                    </a>
                    {p.summary && <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">{p.summary}</p>}
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
                    aria-label={`Angle for ${p.title}`}
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
        </div>
      )}

      {pending.length > 0 && (
        <div className="sticky bottom-20 lg:bottom-4 z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-800 bg-[#0a0a0a]/95 backdrop-blur">
          <p className="text-[11px] text-zinc-400 pl-1">
            {chosen.length
              ? `${writeCount} to write · ${chosen.length - writeCount} to pass`
              : `${pending.length} waiting — pick Write it or Pass`}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCalls((c) => ({ ...Object.fromEntries(pending.map((p) => [p.id, 'pass' as Call])), ...c }))}
              disabled={sending || chosen.length === pending.length}
              className="px-3 py-1.5 rounded-full border border-zinc-800 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
              title="Mark every undecided pitch as a pass"
            >
              Pass the rest
            </button>
            <button
              onClick={send}
              disabled={!chosen.length || sending}
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
                    <p className="text-zinc-300 line-clamp-1">{p.title}</p>
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
