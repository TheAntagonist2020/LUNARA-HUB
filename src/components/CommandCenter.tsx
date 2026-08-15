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
  // Calculated stats
  const totalReach = posts.reduce((acc, p) => acc + (p.engagementStats.reach || 0), 0) + 1250000;
  const totalLikes = posts.reduce((acc, p) => acc + (p.engagementStats.likes || 0), 0);
  const totalClicks = posts.reduce((acc, p) => acc + (p.engagementStats.clicks || 0), 0) + 28400;
  const avgEngagement = 12.4;

  const queuedPosts = posts.filter(p => p.status === 'scheduled' || p.status === 'queued');

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
            Real-time social reach, automated Gemini AI review synthesis, and cross-platform campaign deployment for LUNARA FILM.
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

      {/* Aggregate Reach Column Strip (Matching Sophisticated Dark Mockup) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">Total Impressions</p>
          <p className="text-4xl font-serif text-[#D4AF37]">{(totalReach / 1000).toFixed(1)}k</p>
          <p className="text-[10px] text-emerald-400 font-mono pt-1">+18.4% Weekly Growth</p>
        </div>

        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">Engagement Rate</p>
          <p className="text-4xl font-serif text-white">{avgEngagement}%</p>
          <p className="text-[10px] text-zinc-400 font-mono pt-1">Optimal Cinephile Ratio</p>
        </div>

        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">LunaraFilm.com Clicks</p>
          <p className="text-4xl font-serif text-white">{(totalClicks / 1000).toFixed(1)}k</p>
          <p className="text-[10px] text-emerald-400 font-mono pt-1">Direct Article Traffic</p>
        </div>

        <div className="bg-[#0a0a0a] border border-zinc-800 p-6 rounded-xl space-y-1 hover:border-[#D4AF37]/50 transition-all">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">Active Queue</p>
          <p className="text-4xl font-serif text-[#D4AF37]">{queuedPosts.length}</p>
          <button onClick={onGoToPlanner} className="text-[10px] text-zinc-400 hover:text-[#D4AF37] font-mono pt-1 flex items-center gap-1">
            View Editorial Calendar →
          </button>
        </div>
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
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping" />
                Signal Flow
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 uppercase">Live Webhook</span>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
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

          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>Encryption: AES-256</span>
            <span>Cloud Sync: Active</span>
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
              Transform logged movie reviews into multi-platform social media posts via Gemini AI.
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
