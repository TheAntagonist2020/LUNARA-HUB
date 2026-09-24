import React, { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, PenLine, Send, Undo2 } from 'lucide-react';
import { HotTake, NewsStory, Spice, WorkshopThread } from '../../types';

export const EMPTY_THREAD: WorkshopThread = { messages: [], versions: [] };

// One-tap notes for the edits that come up most.
const QUICK_NOTES = [
  'Punchier',
  'More specific',
  'Less snark, more love',
  'Find a different angle',
  'Sounds like a press release',
  'Shorter post',
];

interface TakeWorkshopProps {
  story: NewsStory;
  take: HotTake | null;
  spice: Spice;
  thread: WorkshopThread;
  onThread: (update: (thread: WorkshopThread) => WorkshopThread) => void;
  onTake: (take: HotTake) => void;
}

// Dalton and Claude hone the take together, right here: notes in, revisions
// back. Every revision replaces the draft the dispatch panel uses; undo steps
// back through earlier versions.
export const TakeWorkshop: React.FC<TakeWorkshopProps> = ({ story, take, spice, thread, onThread, onTake }) => {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNote('');
    setError(null);
    setEditing(false);
  }, [story.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread.messages.length, sending]);

  const base = (): HotTake =>
    take || { summary: story.summary, take: '', post: '', hashtags: [], provider: 'claude', spice };

  const pushVersion = () => {
    if (take?.take) onThread((t) => ({ ...t, versions: [...t.versions.slice(-19), { take: take.take, post: take.post }] }));
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    const messages = [...thread.messages, { role: 'dalton' as const, text: clean }];
    onThread((t) => ({ ...t, messages: [...t.messages, { role: 'dalton', text: clean }] }));
    setNote('');
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/news/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: story.id,
          story: { title: story.title, source: story.source, summary: story.summary, category: story.category, film: story.film },
          current: { take: take?.take || '', post: take?.post || '' },
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      pushVersion();
      onTake({ ...base(), take: data.take, post: data.post, provider: data.provider });
      onThread((t) => ({ ...t, messages: [...t.messages, { role: 'claude', text: data.reply || 'Revised.' }] }));
    } catch (err: any) {
      setError(err.message || 'Claude did not answer.');
    } finally {
      setSending(false);
    }
  };

  const undo = () => {
    const last = thread.versions[thread.versions.length - 1];
    if (!last) return;
    onThread((t) => ({ ...t, versions: t.versions.slice(0, -1) }));
    onTake({ ...base(), take: last.take, post: last.post });
  };

  const saveEdit = () => {
    const text = draft.trim();
    if (text && text !== take?.take) {
      pushVersion();
      onTake({ ...base(), take: text });
      onThread((t) => ({ ...t, messages: [...t.messages, { role: 'dalton', text: `(Edited the take by hand) ${text}` }] }));
    }
    setEditing(false);
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#050505] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-serif italic text-xl text-zinc-100">Workshop</h3>
          <p className="text-[11px] text-zinc-500">Hone it with Claude. Notes in, revisions back. Nothing leaves the hub until you send it.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {take?.take && !editing && (
            <button
              onClick={() => {
                setDraft(take.take);
                setEditing(true);
              }}
              className="p-2 rounded-full border border-zinc-800 text-zinc-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/60"
              aria-label="Edit the take yourself"
              title="Edit the take yourself"
            >
              <PenLine className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={undo}
            disabled={!thread.versions.length || sending}
            className="p-2 rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            aria-label="Back to the previous version"
            title="Back to the previous version"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            autoFocus
            aria-label="Edit the take"
            className="w-full resize-y rounded-xl bg-black border border-[#D4AF37]/50 focus:outline-none p-3 font-serif italic text-[1.05rem] leading-snug text-amber-50"
          />
          <div className="flex justify-end gap-2 text-[10px] font-mono uppercase tracking-[0.16em]">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-400">
              Cancel
            </button>
            <button onClick={saveEdit} className="px-3 py-1.5 rounded-full bg-[#D4AF37] text-black font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> Keep it
            </button>
          </div>
        </div>
      )}

      {thread.messages.length > 0 && (
        <div ref={logRef} className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {thread.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'dalton' ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'dalton'
                    ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-zinc-100 rounded-br-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-bl-md'
                }`}
              >
                {m.text}
              </p>
            </div>
          ))}
          {sending && (
            <p className="text-[12px] text-zinc-500 flex items-center gap-2 pl-1">
              <LoaderCircle className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" /> Claude's reworking it…
            </p>
          )}
        </div>
      )}
      {sending && thread.messages.length === 0 && (
        <p className="text-[12px] text-zinc-500 flex items-center gap-2">
          <LoaderCircle className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" /> Claude's reworking it…
        </p>
      )}

      {error && (
        <p className="text-[12px] text-amber-300">
          {error}{' '}
          <button
            onClick={() => {
              const lastNote = [...thread.messages].reverse().find((m) => m.role === 'dalton');
              if (lastNote) {
                onThread((t) => ({ ...t, messages: t.messages.slice(0, -1) }));
                send(lastNote.text);
              }
            }}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {QUICK_NOTES.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={sending}
            className="px-2.5 py-1 rounded-full border border-zinc-800 text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(note);
            }
          }}
          rows={2}
          placeholder={take?.take ? "Tell Claude what to change, or write the line you'd say…" : 'Give Claude the angle and it drafts the take…'}
          aria-label="Note to Claude"
          className="flex-1 resize-none rounded-xl bg-black border border-zinc-800 focus:border-[#D4AF37]/60 focus:outline-none px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600"
        />
        <button
          onClick={() => send(note)}
          disabled={!note.trim() || sending}
          aria-label="Send note to Claude"
          className="h-10 w-10 shrink-0 rounded-full bg-[#D4AF37] text-black flex items-center justify-center disabled:opacity-30"
        >
          {sending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </section>
  );
};
