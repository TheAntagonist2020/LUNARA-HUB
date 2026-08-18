import React from 'react';
import { FilmJournalEntry, SocialPost, PlatformMetric, LiveActivity } from '../types';
import { PlatformIcon, getPlatformBg } from './PlatformIcon';
import { Eye, TrendingUp, MousePointerClick, Calendar, Radio, ArrowUpRight, Sparkles, CheckCircle2, Clock, Send, Star, ExternalLink, RefreshCw } from 'lucide-react';

interface CommandCenterProps {
  posts: SocialPost[];
  journalEntries: FilmJournalEntry[];
  platformMetrics: PlatformMetric[];
  liveActivities: LiveActivity[];
  onOpenNewPost: () => void;
  onOpenNewJournal: () => void;
  onSelectJournalForAI: (entry: FilmJournalEntry) => void;
  onPublishPostNow: (postId: string) => void;
  onGoToPlanner: () => void;
  onGoToAnalytics: () => void;
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  posts,
  journalEntries,
  platformMetrics,
  liveActivities,
  onOpenNewPost,
  onOpenNewJournal,
  onSelectJournalForAI,
  onPublishPostNow,
  onGoToPlanner,
  onGoToAnalytics,
  isSimulating,
  setIsSimulating,
}) => {
  const queuedPosts = posts.filter(p => p.status === 'scheduled' || p.status === 'queued');
  const publishedPosts = posts.filter(p => p.status === 'published');

  // Live integration status from the local server — the same source of truth
  // as the terminal startup log, so the app and terminal always agree.
  const [health, setHealth] = React.useState<any | null>(null);
  const [drafts, setDrafts] = React.useState<any[] | null>(null);
  const [draftsError, setDraftsError] = React.useState<string | null>(null);
  React.useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));
    fetch('/api/wordpress/drafts')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) {
          setDraftsError(data.error || `Drafts unavailable (HTTP ${res.status})`);
          setDrafts(null);
        } else {
          setDrafts(data.drafts || []);
          setDraftsError(null);
        }
      })
      .catch((err) => setDraftsError(err.message || 'Drafts unavailable'));
  }, []);

  const aiEngineLabels: Record<string, string> = {
    claude: 'Claude · Max plan',
    gemini: 'Gemini · free tier',
    template: 'Offline templates',
  };
  const aiEngine = health ? aiEngineLabels[health.aiProviderOrder?.[0]] || 'Offline templates' : '…';
  const typefullyOn = Boolean(health?.integrations?.typefullyKey);

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Hero Welcome & Control Strip */}
      <div className="bg-[#0a0a0a] rounded-xl p-8 border border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#D4AF37]">
              LUNARA FILM ARCHIVE • EDITORIAL QUEUE
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-zinc-100">
            Journal Control & Media Hub
          </h1>
          <p className="text-zinc-400 text-xs max-w-xl leading-relaxed">
            Your lunarafilm.com journal, AI campaign synthesis on subscriptions you already pay for, and Typefully dispatch — all local, all $0 extra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] font-mono tracking-widest border transition-all ${
              isSimulating
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isSimulating ? 'text-emerald-400 animate-pulse' : ''}`} />
            {isSimulating ? 'SIGNAL ACTIVE' : 'SIGNAL PAUSED'}
          </button>

          <button
            onClick={onOpenNewPost}
            className="px-6 py-2.5 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-lg"
          >
            Create Entry
          </button>
        </div>
      </div>

      {/* Real Status Strip — journal size, queue, and live integration state */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">Journal Entries</p>
          <p className="text-4xl font-serif text-[#D4AF37]">{journalEntries.length}</p>
          <p className="text-[10px] text-zinc-400 font-mono pt-1">Synced from lunarafilm.com + local logs</p>
        </div>

        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">Active Queue</p>
          <p className="text-4xl font-serif text-white">{queuedPosts.length}</p>
          <button onClick={onGoToPlanner} className="text-[10px] text-zinc-400 hover:text-[#D4AF37] font-mono pt-1 flex items-center gap-1">
            View Planner → {publishedPosts.length > 0 ? `(${publishedPosts.length} published)` : ''}
          </button>
        </div>

        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">AI Engine</p>
          <p className="text-2xl font-serif text-white pt-2">{aiEngine}</p>
          <p className="text-[10px] text-emerald-400 font-mono pt-1">$0 extra — uses what you already pay for</p>
        </div>

        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">Typefully</p>
          <p className={`text-2xl font-serif pt-2 ${typefullyOn ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {health === null ? '…' : typefullyOn ? 'Connected' : 'Not connected'}
          </p>
          <p className="text-[10px] text-zinc-400 font-mono pt-1">
            {typefullyOn ? 'Dispatches land in your drafts queue' : 'Add TYPEFULLY_API_KEY to .env'}
          </p>
        </div>
      </div>

      {/* Awaiting Review — drafts produced by Lunara Dispatch and Claude */}
      <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-serif italic text-zinc-100">Awaiting Review</h2>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">
              Site drafts from Dispatch automation & Claude — review, then publish
            </p>
          </div>
          {drafts !== null && (
            <span className="text-xs font-mono text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2.5 py-0.5 rounded">
              {drafts.length} draft{drafts.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {draftsError && (
          <p className="text-xs text-zinc-400 font-mono leading-relaxed">{draftsError}</p>
        )}
        {drafts !== null && drafts.length === 0 && (
          <p className="text-xs text-zinc-400">Nothing awaiting review — the desk is clear.</p>
        )}
        {drafts !== null && drafts.length > 0 && (
          <div className="space-y-2">
            {drafts.slice(0, 8).map((d) => (
              <div
                key={`${d.postType}-${d.id}`}
                className="p-3 bg-[#050505] border border-zinc-800/90 rounded-lg flex items-center justify-between gap-3 hover:border-[#D4AF37]/50 transition-all"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] px-2 py-0.5 bg-zinc-900 text-[#D4AF37] uppercase font-bold tracking-tighter border border-[#D4AF37]/20 shrink-0">
                      {d.postType}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {d.modified ? new Date(d.modified).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                  <h3 className="text-sm font-serif text-zinc-200 line-clamp-1">{d.title}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono uppercase tracking-wider">
                  <a
                    href={d.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
                  >
                    Preview
                  </a>
                  <a
                    href={d.editUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-all"
                  >
                    Edit
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid: Editorial Queue vs Signal Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Editorial Queue List (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-xl font-serif italic text-zinc-100">
                Editorial & Campaign Queue
              </h2>
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">
                Upcoming social coverage ready for release
              </p>
            </div>
            <button
              onClick={onGoToPlanner}
              className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#D4AF37] hover:underline"
            >
              Full Calendar
            </button>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {posts.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <Sparkles className="w-7 h-7 text-[#D4AF37]/60 mx-auto" />
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Your queue is empty. Pick a review in the spotlight below and hit
                  <span className="text-[#D4AF37] font-semibold"> Generate Social Posts</span> —
                  the AI drafts the campaign, then push it to your queue or straight to Typefully.
                </p>
              </div>
            )}
            {posts.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="group p-4 bg-[#050505] border border-zinc-800/90 rounded-lg flex items-center justify-between hover:border-[#D4AF37] transition-all"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center shrink-0">
                    <PlatformIcon platform={post.platform} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[9px] px-2 py-0.5 bg-zinc-900 text-zinc-400 uppercase tracking-tighter border border-zinc-800">
                        {post.platform}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 bg-zinc-900 text-[#D4AF37] uppercase font-bold tracking-tighter border border-[#D4AF37]/20">
                        {post.filmTitle || 'Cinephile Essay'}
                      </span>
                    </div>
                    <h3 className="text-sm font-serif line-clamp-1 text-zinc-200">
                      {post.content}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      Scheduled: {new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-mono px-2 py-1 rounded border ${
                    post.status === 'published'
                      ? 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30'
                      : 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30'
                  }`}>
                    {post.status.toUpperCase()}
                  </span>
                  {post.status !== 'published' && (
                    <button
                      onClick={() => onPublishPostNow(post.id)}
                      className="block text-[10px] text-zinc-400 hover:text-emerald-400 mt-2 font-mono"
                    >
                      Publish Now
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Signal Flow Stream (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 font-semibold flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-[#D4AF37] ${isSimulating ? 'animate-ping' : ''}`} />
                Signal Flow
              </h2>
              <span className={`text-[10px] font-mono uppercase ${isSimulating ? 'text-amber-400' : 'text-zinc-500'}`}>
                {isSimulating ? 'Demo stream' : 'Off'}
              </span>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {liveActivities.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <Radio className="w-6 h-6 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400 max-w-[260px] mx-auto leading-relaxed">
                    Real per-post engagement needs each platform's API and isn't wired up yet.
                    Toggle <span className="text-zinc-200 font-mono text-[10px]">SIGNAL</span> above to run a demo stream.
                  </p>
                </div>
              )}
              {liveActivities.slice(0, 6).map((act) => (
                <div key={act.id} className="border-l-2 border-[#D4AF37] pl-4 py-1 space-y-0.5 group">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
                    <span>{act.timestamp} / {act.platform}</span>
                    <span className="text-emerald-400">+{act.engagementDelta} pts</span>
                  </div>
                  <p className="text-xs text-zinc-300">
                    <strong className="text-zinc-100 font-normal">{act.username}</strong>: <span className="italic font-serif">"{act.postSnippet}"</span>
                  </p>
                  <p className="text-[10px] text-[#D4AF37] font-mono">Film: {act.filmTitle}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800 text-[10px] text-zinc-500 font-mono text-center">
            <span>{isSimulating ? 'Simulated engagement for layout preview — not real data' : 'Feed idle'}</span>
          </div>
        </div>

      </div>

      {/* Film Journal Spotlight Deck */}
      <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-serif italic text-zinc-100 flex items-center gap-2">
              <span>LUNARA Film Journal Spotlight</span>
            </h2>
            <p className="text-xs text-zinc-500">
              Transform logged movie reviews into multi-platform social media posts with your AI copilot.
            </p>
          </div>
          <button
            onClick={onOpenNewJournal}
            className="px-4 py-1.5 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded"
          >
            + Log Film
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {journalEntries.slice(0, 4).map((entry) => (
            <div
              key={entry.id}
              className="bg-[#050505] rounded-xl overflow-hidden border border-zinc-800 hover:border-[#D4AF37] transition-all flex flex-col justify-between group"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={entry.posterUrl}
                  alt={entry.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-transparent" />
                <div className="absolute top-3 right-3 bg-black/80 px-2 py-0.5 rounded border border-[#D4AF37]/40 text-xs text-[#D4AF37] font-bold flex items-center gap-1 font-mono">
                  <Star className="w-3 h-3 fill-[#D4AF37] text-[#D4AF37]" /> {entry.rating}
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="font-serif text-lg font-bold text-zinc-100 line-clamp-1">
                    {entry.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {entry.director} ({entry.year})
                  </p>
                </div>
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <p className="text-xs text-zinc-300 italic font-serif line-clamp-2">
                  "{entry.reviewText}"
                </p>

                <button
                  onClick={() => onSelectJournalForAI(entry)}
                  className="w-full py-2 border border-[#D4AF37]/50 hover:border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10 uppercase text-[10px] tracking-[0.15em] font-bold transition-all rounded flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate Social Posts
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
