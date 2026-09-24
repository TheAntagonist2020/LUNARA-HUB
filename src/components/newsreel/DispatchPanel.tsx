import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleAlert, Copy, LoaderCircle, Send, Zap } from 'lucide-react';
import { HotTake, NewsStory } from '../../types';
import { composePost, loadJson, saveJson, xLength } from './wire';

export interface DispatchIntegrations {
  typefully: boolean;
  buffer: boolean;
}

interface BufferChannel {
  id: string;
  name: string;
  handle: string;
  service: string;
  avatar?: string;
  queuePaused: boolean;
  usable: boolean;
}

type SendState = { state: 'idle' | 'sending' | 'done' | 'error'; message?: string };

interface DispatchPanelProps {
  story: NewsStory;
  take: HotTake | null;
  integrations: DispatchIntegrations | null;
}

// Channels only load once per session — every open sheet shares them.
let bufferChannelsPromise: Promise<{ channels: BufferChannel[]; defaultChannelIds: string[] }> | null = null;
function loadBufferChannels() {
  if (!bufferChannelsPromise) {
    bufferChannelsPromise = fetch('/api/buffer/channels')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      })
      .catch((err) => {
        bufferChannelsPromise = null;
        throw err;
      });
  }
  return bufferChannelsPromise;
}

const BUFFER_MODES: Array<{ id: 'queue' | 'next' | 'draft'; label: string }> = [
  { id: 'queue', label: 'Queue' },
  { id: 'next', label: 'Share next' },
  { id: 'draft', label: 'Draft' },
];

export const DispatchPanel: React.FC<DispatchPanelProps> = ({ story, take, integrations }) => {
  const [text, setText] = useState(() => composePost(story, take));
  const edited = useRef(false);
  const officialArt = story.image?.official ? story.image : null;
  const [attachArt, setAttachArt] = useState(Boolean(officialArt));
  const [typefully, setTypefully] = useState<SendState>({ state: 'idle' });
  const [buffer, setBuffer] = useState<SendState>({ state: 'idle' });
  const [copied, setCopied] = useState(false);

  const [channels, setChannels] = useState<BufferChannel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(() => loadJson('lunara_buffer_channels', [] as string[]));
  const [bufferMode, setBufferMode] = useState<'queue' | 'next' | 'draft'>('queue');

  // New story, or a fresh take arrived before any hand edits: re-draft.
  useEffect(() => {
    edited.current = false;
    setText(composePost(story, take));
    setAttachArt(Boolean(story.image?.official));
    setTypefully({ state: 'idle' });
    setBuffer({ state: 'idle' });
  }, [story.id]);

  useEffect(() => {
    if (!edited.current) setText(composePost(story, take));
  }, [take]);

  useEffect(() => {
    if (!integrations?.buffer) return;
    loadBufferChannels()
      .then((data) => {
        setChannels(data.channels);
        const usable = (id: string) => data.channels.some((c) => c.id === id && c.usable);
        setSelected((prev) => {
          const valid = prev.filter(usable);
          return valid.length ? valid : data.defaultChannelIds.filter(usable);
        });
      })
      .catch((err) => setChannelsError(err.message));
  }, [integrations?.buffer]);

  const counts = useMemo(() => ({ x: xLength(text), real: text.length }), [text]);
  const imageUrl = attachArt && officialArt ? officialArt.url : undefined;
  const imageAlt = story.film ? `${story.film.title} — official art (${officialArt?.credit})` : story.title;
  const aiWritten = Boolean(take && take.provider !== 'template');

  const sendTypefully = async (scheduleToNextSlot: boolean) => {
    setTypefully({ state: 'sending' });
    try {
      const res = await fetch('/api/typefully/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, scheduleToNextSlot, imageUrl, imageAlt, title: story.title }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const where = scheduleToNextSlot ? 'the next free slot' : 'your drafts';
      const art = imageUrl ? (data.mediaAttached ? ' with key art' : ` — sent without art (${data.mediaNote})`) : '';
      setTypefully({
        state: 'done',
        message: `Landed in ${where} on ${data.platforms?.join(', ') || 'Typefully'}${art}.`,
      });
    } catch (err: any) {
      setTypefully({ state: 'error', message: err.message });
    }
  };

  const sendBuffer = async () => {
    setBuffer({ state: 'sending' });
    saveJson('lunara_buffer_channels', selected);
    try {
      const res = await fetch('/api/buffer/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, channelIds: selected, mode: bufferMode, imageUrl, aiAssisted: aiWritten }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      const ok = data.results.filter((r: any) => r.ok).length;
      const failed = data.results.filter((r: any) => !r.ok);
      const verb = bufferMode === 'draft' ? 'Saved as a draft' : bufferMode === 'next' ? 'Up next' : 'Queued';
      setBuffer({
        state: failed.length ? 'error' : 'done',
        message: `${verb} on ${ok} channel${ok === 1 ? '' : 's'}.${
          failed.length ? ` ${failed.length} refused: ${failed.map((f: any) => f.error).join(' · ')}` : ''
        }`,
      });
    } catch (err: any) {
      setBuffer({ state: 'error', message: err.message });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const usableChannels = (channels || []).filter((c) => c.usable);

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => {
            edited.current = true;
            setText(e.target.value);
          }}
          rows={6}
          aria-label="Social post copy"
          className="w-full resize-y rounded-xl bg-[#050505] border border-zinc-800 focus:border-[#D4AF37]/70 focus:outline-none p-3.5 text-[13px] leading-relaxed text-zinc-100 placeholder:text-zinc-600"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.16em]">
          <span className={counts.x > 280 ? 'text-amber-400' : 'text-zinc-500'}>
            X {counts.x}/280 <span className="text-zinc-700">·</span>{' '}
            <span className={counts.real > 300 ? 'text-amber-400' : ''}>Bluesky {counts.real}/300</span>
          </span>
          <button onClick={copy} className="flex items-center gap-1 text-zinc-400 hover:text-[#D4AF37] transition-colors">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {officialArt ? (
        <label className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800 bg-[#050505] cursor-pointer">
          <input
            type="checkbox"
            checked={attachArt}
            onChange={(e) => setAttachArt(e.target.checked)}
            className="accent-[#D4AF37] w-4 h-4"
          />
          <img
            src={officialArt.url}
            alt=""
            referrerPolicy="no-referrer"
            className="w-14 h-9 rounded object-cover border border-zinc-800"
          />
          <span className="text-[11px] text-zinc-300 leading-snug">
            Attach official art <span className="text-zinc-500">· {officialArt.credit} · vault backup included</span>
          </span>
        </label>
      ) : (
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Outlet photos stay with the outlet — the link preview does the visual work on this one.
        </p>
      )}

      {/* Typefully */}
      <div className="rounded-xl border border-zinc-800 bg-[#050505] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-sky-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Typefully
          </span>
          {integrations && !integrations.typefully && (
            <span className="text-[10px] font-mono text-zinc-500">Add TYPEFULLY_API_KEY (v2) to .env</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!integrations?.typefully || typefully.state === 'sending'}
            onClick={() => sendTypefully(false)}
            className="py-2.5 rounded-lg border border-sky-500/40 text-sky-200 text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-sky-500/10 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
          >
            Save draft
          </button>
          <button
            disabled={!integrations?.typefully || typefully.state === 'sending'}
            onClick={() => sendTypefully(true)}
            className="py-2.5 rounded-lg bg-sky-500/90 text-black text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-sky-400 disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
          >
            {typefully.state === 'sending' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Next free slot
          </button>
        </div>
        <StatusLine status={typefully} />
      </div>

      {/* Buffer */}
      <div className="rounded-xl border border-zinc-800 bg-[#050505] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-200 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm bg-zinc-200 text-black text-[8px] font-black flex items-center justify-center">B</span>
            Buffer
          </span>
          {integrations && !integrations.buffer && (
            <span className="text-[10px] font-mono text-zinc-500">Add BUFFER_API_KEY to .env</span>
          )}
        </div>

        {integrations?.buffer && (
          <>
            {channelsError && <p className="text-[11px] text-amber-300/90">{channelsError}</p>}
            {!channels && !channelsError && (
              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                <LoaderCircle className="w-3 h-3 animate-spin" /> Loading channels…
              </p>
            )}
            {channels && usableChannels.length === 0 && (
              <p className="text-[11px] text-zinc-500">
                No text-friendly channels connected (X, Threads, Bluesky, Mastodon, LinkedIn, Facebook).
              </p>
            )}
            {usableChannels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {usableChannels.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected((prev) => (on ? prev.filter((id) => id !== c.id) : [...prev, c.id]))}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-[11px] transition-all ${
                        on ? 'border-[#D4AF37]/70 bg-[#D4AF37]/10 text-zinc-100' : 'border-zinc-800 text-zinc-500'
                      }`}
                      title={c.queuePaused ? 'Queue paused in Buffer' : `${c.service} · ${c.handle}`}
                    >
                      {c.avatar ? (
                        <img src={c.avatar} alt="" referrerPolicy="no-referrer" className="w-5 h-5 rounded-full" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-zinc-800" />
                      )}
                      {c.name}
                      <span className="text-[9px] uppercase text-zinc-500">{c.service}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label="Buffer scheduling" className="flex rounded-lg border border-zinc-800 p-0.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                {BUFFER_MODES.map((m) => (
                  <button
                    key={m.id}
                    role="radio"
                    aria-checked={bufferMode === m.id}
                    onClick={() => setBufferMode(m.id)}
                    className={`px-2.5 py-1.5 rounded-md transition-all ${
                      bufferMode === m.id ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                disabled={!selected.length || buffer.state === 'sending'}
                onClick={sendBuffer}
                className="flex-1 py-2 rounded-lg bg-zinc-100 text-black text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-white disabled:opacity-35 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {buffer.state === 'sending' ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send · {selected.length}
              </button>
            </div>
          </>
        )}
        <StatusLine status={buffer} />
      </div>
    </div>
  );
};

const StatusLine: React.FC<{ status: SendState }> = ({ status }) => {
  if (status.state !== 'done' && status.state !== 'error') return null;
  const ok = status.state === 'done';
  return (
    <p className={`text-[11px] leading-snug flex items-start gap-1.5 ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
      {ok ? <Check className="w-3.5 h-3.5 shrink-0 mt-px" /> : <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />}
      <span>{status.message}</span>
    </p>
  );
};
