import React, { useState } from 'react';
import { SocialPost, PlatformType, PostStatus } from '../types';
import { PlatformIcon, getPlatformBg } from './PlatformIcon';
import { Calendar, LayoutGrid, List, Plus, Search, Filter, Trash2, Edit3, Send, Sparkles, CheckCircle2, Clock, Copy, Eye, Star, Heart, MessageCircle, Repeat, Share2, Twitter, Instagram, Film } from 'lucide-react';

interface SocialPlannerProps {
  posts: SocialPost[];
  onOpenNewPost: () => void;
  onEditPost: (post: SocialPost) => void;
  onDeletePost: (postId: string) => void;
  onUpdateStatus: (postId: string, status: PostStatus) => void;
  onPolishWithAI: (post: SocialPost) => void;
}

export const SocialPlanner: React.FC<SocialPlannerProps> = ({
  posts,
  onOpenNewPost,
  onEditPost,
  onDeletePost,
  onUpdateStatus,
  onPolishWithAI,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [platformFilter, setPlatformFilter] = useState<PlatformType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);
  const [typefullyState, setTypefullyState] = useState<Record<string, 'sending' | 'sent'>>({});

  const handleSendToTypefully = async (post: SocialPost) => {
    if (typefullyState[post.id]) return;
    setTypefullyState((prev) => ({ ...prev, [post.id]: 'sending' }));
    try {
      const res = await fetch('/api/typefully/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.content, scheduleToNextSlot: false }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Typefully dispatch failed');
      }
      setTypefullyState((prev) => ({ ...prev, [post.id]: 'sent' }));
      onUpdateStatus(post.id, 'scheduled');
    } catch (err: any) {
      setTypefullyState((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
      alert(err.message || 'Typefully dispatch failed');
    }
  };

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const matchesPlatform = platformFilter === 'all' || post.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.filmTitle && post.filmTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPlatform && matchesStatus && matchesSearch;
  });

  const columns: { status: PostStatus; title: string; color: string }[] = [
    { status: 'draft', title: 'Drafts', color: 'border-zinc-800 bg-[#0a0a0a]' },
    { status: 'queued', title: 'Queued', color: 'border-zinc-800 bg-[#0a0a0a]' },
    { status: 'scheduled', title: 'Scheduled', color: 'border-zinc-800 bg-[#0a0a0a]' },
    { status: 'published', title: 'Published', color: 'border-zinc-800 bg-[#0a0a0a]' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0a0a0a] p-6 rounded-xl border border-zinc-800">
        <div>
          <h2 className="font-serif text-2xl italic font-bold text-zinc-100 flex items-center gap-3">
            <span>Social Media Content Planner</span>
            <span className="text-[10px] font-mono uppercase tracking-widest bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 px-2.5 py-0.5 rounded">
              {filteredPosts.length} entries
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Organize drafts, schedule multi-platform posts, and preview device cards before publishing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-[#050505] rounded-lg border border-zinc-800">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
                viewMode === 'kanban'
                  ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
                viewMode === 'calendar'
                  ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>

          <button
            onClick={onOpenNewPost}
            className="flex items-center gap-1.5 px-4 py-2 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Post
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts or movie titles..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {/* Platform Selector Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-xs text-zinc-400 font-mono flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-amber-400" /> Platform:
          </span>
          <button
            onClick={() => setPlatformFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              platformFilter === 'all'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All
          </button>
          {(['twitter', 'instagram', 'letterboxd', 'tiktok', 'threads'] as PlatformType[]).map((pf) => (
            <button
              key={pf}
              onClick={() => setPlatformFilter(pf)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                platformFilter === pf
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              <PlatformIcon platform={pf} />
              <span className="capitalize">{pf}</span>
            </button>
          ))}
        </div>

      </div>

      {/* VIEW MODE: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colPosts = filteredPosts.filter((p) => p.status === col.status);
            return (
              <div
                key={col.status}
                className={`rounded-2xl p-4 border ${col.color} space-y-3 min-h-[500px] flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
                    <h3 className="font-serif font-bold text-sm text-zinc-200 flex items-center gap-2">
                      <span>{col.title}</span>
                      <span className="text-xs font-mono bg-zinc-950 px-2 py-0.5 rounded-full text-zinc-400 border border-zinc-800">
                        {colPosts.length}
                      </span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {colPosts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-amber-500/40 transition-all space-y-3 group shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getPlatformBg(post.platform)}`}>
                            <PlatformIcon platform={post.platform} showLabel />
                          </span>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={() => setPreviewPost(post)}
                              title="Device Preview"
                              className="p-1 rounded text-zinc-400 hover:text-amber-300 hover:bg-zinc-800"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onPolishWithAI(post)}
                              title="Polish with Gemini AI"
                              className="p-1 rounded text-zinc-400 hover:text-purple-300 hover:bg-zinc-800"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            </button>
                            <button
                              onClick={() => onEditPost(post)}
                              title="Edit post"
                              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeletePost(post.id)}
                              title="Delete post"
                              className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {post.filmTitle && (
                          <span className="text-[11px] text-amber-300 font-semibold block">
                            🎬 {post.filmTitle}
                          </span>
                        )}

                        <p className="text-xs text-zinc-200 font-serif line-clamp-4 leading-relaxed">
                          {post.content}
                        </p>

                        {post.hashtags && post.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.hashtags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} className="text-[10px] text-zinc-500 font-mono">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400/80" />
                            {new Date(post.scheduledTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>

                          <div className="flex items-center gap-2">
                            {post.status !== 'published' && (
                              <button
                                onClick={() => handleSendToTypefully(post)}
                                disabled={Boolean(typefullyState[post.id])}
                                title="Send this post to your Typefully drafts"
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 transition-all ${
                                  typefullyState[post.id] === 'sent'
                                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80'
                                    : 'text-sky-400 hover:text-sky-300 bg-sky-950/60 border-sky-800/80'
                                }`}
                              >
                                {typefullyState[post.id] === 'sent' ? (
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                ) : (
                                  <Send className="w-2.5 h-2.5" />
                                )}
                                {typefullyState[post.id] === 'sent'
                                  ? 'In Typefully'
                                  : typefullyState[post.id] === 'sending'
                                    ? 'Sending…'
                                    : 'Typefully'}
                              </button>
                            )}
                            {post.status !== 'published' && (
                              <button
                                onClick={() => onUpdateStatus(post.id, 'published')}
                                className="text-[10px] font-semibold text-emerald-400 hover:underline flex items-center gap-0.5"
                              >
                                <Send className="w-2.5 h-2.5" /> Publish
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE: LIST TABLE */}
      {viewMode === 'list' && (
        <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-zinc-400 uppercase font-mono border-b border-zinc-800 text-[10px]">
                <tr>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Film / Topic</th>
                  <th className="py-3 px-4 max-w-md">Post Content</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border ${getPlatformBg(post.platform)}`}>
                        <PlatformIcon platform={post.platform} showLabel />
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-300">
                      {post.filmTitle || 'General Film Feature'}
                    </td>
                    <td className="py-3 px-4 max-w-md font-serif text-zinc-200 line-clamp-2">
                      {post.content}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                      {new Date(post.scheduledTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {post.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewPost(post)}
                          title="Preview device view"
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEditPost(post)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeletePost(post.id)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE: CALENDAR */}
      {viewMode === 'calendar' && (
        <div className="bg-zinc-900/90 rounded-2xl p-6 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-serif font-bold text-lg text-zinc-100">
              Weekly LUNARA Social Publishing Matrix
            </h3>
            <span className="text-xs font-mono text-amber-400">July 2026</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => (
              <div key={day} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 min-h-[220px] space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-1 text-zinc-400 font-mono">
                  <span>{day}</span>
                  <span className="text-amber-400">{27 + dIdx}</span>
                </div>

                <div className="space-y-2">
                  {filteredPosts
                    .filter((_, idx) => idx % 7 === dIdx)
                    .map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setPreviewPost(post)}
                        className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 text-[11px] cursor-pointer space-y-1 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <PlatformIcon platform={post.platform} />
                          <span className="text-[9px] font-mono text-zinc-500">
                            {new Date(post.scheduledTime).getHours()}:00
                          </span>
                        </div>
                        <p className="line-clamp-2 text-zinc-300 font-serif">
                          {post.content}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PREVIEW DEVICE MODAL */}
      {previewPost && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={previewPost.platform} />
                <h3 className="font-serif font-bold text-sm text-zinc-100 capitalize">
                  {previewPost.platform} Live Device Preview
                </h3>
              </div>
              <button
                onClick={() => setPreviewPost(null)}
                className="text-zinc-400 hover:text-zinc-100 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Platform Specific Mock Frame */}
            {previewPost.platform === 'twitter' && (
              <div className="bg-black p-4 rounded-xl border border-zinc-800 space-y-3 font-sans text-xs text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-xs">
                      LF
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-1">
                        LUNARA FILM <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
                      </div>
                      <div className="text-zinc-500 text-[10px]">@LunaraFilm</div>
                    </div>
                  </div>
                  <Twitter className="w-4 h-4 text-sky-400" />
                </div>

                <p className="text-sm leading-relaxed font-serif text-zinc-100 whitespace-pre-wrap">
                  {previewPost.content}
                </p>

                {previewPost.mediaUrl && (
                  <img
                    src={previewPost.mediaUrl}
                    alt="preview media"
                    className="w-full h-48 object-cover rounded-xl border border-zinc-800"
                  />
                )}

                <div className="flex items-center justify-between text-zinc-500 pt-2 border-t border-zinc-900">
                  <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> 84</span>
                  <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> 312</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> 1.2k</span>
                  <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /></span>
                </div>
              </div>
            )}

            {previewPost.platform === 'instagram' && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 font-sans text-xs text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-pink-500 p-0.5">
                      <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center font-bold text-amber-400 text-[10px]">
                        LF
                      </div>
                    </div>
                    <span className="font-semibold text-xs">lunarafilmjournal</span>
                  </div>
                  <Instagram className="w-4 h-4 text-pink-500" />
                </div>

                {previewPost.mediaUrl ? (
                  <img
                    src={previewPost.mediaUrl}
                    alt="instagram media"
                    className="w-full h-56 object-cover rounded-lg border border-zinc-800"
                  />
                ) : (
                  <div className="w-full h-48 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500">
                    Image Carousel Frame
                  </div>
                )}

                <p className="text-xs text-zinc-200 leading-relaxed font-serif whitespace-pre-wrap">
                  <strong className="font-sans font-bold mr-1">lunarafilmjournal</strong>
                  {previewPost.content}
                </p>
              </div>
            )}

            {previewPost.platform === 'letterboxd' && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-emerald-500/30 space-y-3 font-sans text-xs text-zinc-200">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-mono text-emerald-400 text-xs font-bold uppercase">
                    LETTERBOXD LOGGED BY LUNARA FILM
                  </span>
                  <Film className="w-4 h-4 text-emerald-400" />
                </div>

                <div className="flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className="font-serif text-sm italic text-zinc-100 leading-relaxed">
                  "{previewPost.content}"
                </p>
              </div>
            )}

            {(previewPost.platform === 'tiktok' || previewPost.platform === 'threads') && (
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 text-xs text-zinc-200 font-serif">
                <p className="whitespace-pre-wrap leading-relaxed">{previewPost.content}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewPost.content);
                  alert('Post text copied to clipboard!');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-all"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Text
              </button>

              <button
                onClick={() => setPreviewPost(null)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
