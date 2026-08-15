import React, { useState } from 'react';
import { SocialPost, PlatformType, PostStatus } from '../types';
import { PlatformIcon } from './PlatformIcon';
import { X, Sparkles, Send, Calendar, Clock, Film } from 'lucide-react';

interface NewPostModalProps {
  postToEdit?: SocialPost | null;
  onSave: (postData: Partial<SocialPost>) => void;
  onClose: () => void;
}

export const NewPostModal: React.FC<NewPostModalProps> = ({
  postToEdit,
  onSave,
  onClose,
}) => {
  const [filmTitle, setFilmTitle] = useState(postToEdit?.filmTitle || '');
  const [platform, setPlatform] = useState<PlatformType>(postToEdit?.platform || 'twitter');
  const [content, setContent] = useState(postToEdit?.content || '');
  const [scheduledTime, setScheduledTime] = useState(
    postToEdit?.scheduledTime
      ? new Date(postToEdit.scheduledTime).toISOString().slice(0, 16)
      : new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16)
  );
  const [status, setStatus] = useState<PostStatus>(postToEdit?.status || 'scheduled');
  const [mediaUrl, setMediaUrl] = useState(postToEdit?.mediaUrl || '');
  const [articleUrl, setArticleUrl] = useState(postToEdit?.articleUrl || '');
  const [hashtagsStr, setHashtagsStr] = useState(postToEdit?.hashtags ? postToEdit.hashtags.join(', ') : '#LunaraFilm, #Cinephile');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const hashtags = hashtagsStr
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    onSave({
      ...(postToEdit ? { id: postToEdit.id } : {}),
      filmTitle: filmTitle || undefined,
      platform,
      content,
      scheduledTime: new Date(scheduledTime).toISOString(),
      status,
      mediaUrl: mediaUrl || undefined,
      articleUrl: articleUrl || undefined,
      hashtags,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="font-serif font-bold text-lg text-zinc-100 flex items-center gap-2">
            <span>{postToEdit ? 'Edit Social Post' : 'Schedule New Social Post'}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Film / Topic */}
          <div>
            <label className="block text-zinc-400 font-mono mb-1">Film Title / Feature Name</label>
            <input
              type="text"
              value={filmTitle}
              onChange={(e) => setFilmTitle(e.target.value)}
              placeholder="e.g. Dune: Part Two"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-zinc-400 font-mono mb-1">Platform</label>
            <div className="flex flex-wrap gap-2">
              {(['twitter', 'instagram', 'letterboxd', 'tiktok', 'threads'] as PlatformType[]).map((pf) => (
                <button
                  key={pf}
                  type="button"
                  onClick={() => setPlatform(pf)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    platform === pf
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                  }`}
                >
                  <PlatformIcon platform={pf} />
                  <span className="capitalize">{pf}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-zinc-400 font-mono mb-1">Post Content *</label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write social copy or campaign text..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-200 focus:outline-none focus:border-amber-500/50 font-serif"
            />
          </div>

          {/* Media URL & Article URL */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-mono mb-1">Image / Media URL</label>
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-zinc-400 font-mono mb-1">Lunara Website Link</label>
              <input
                type="text"
                value={articleUrl}
                onChange={(e) => setArticleUrl(e.target.value)}
                placeholder="https://lunarafilm.com/reviews/..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          {/* Schedule Time & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-mono mb-1">Schedule Time</label>
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-mono mb-1">Queue Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PostStatus)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="draft">Draft</option>
                <option value="queued">Queued</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-zinc-400 font-mono mb-1">Hashtags (Comma Separated)</label>
            <input
              type="text"
              value={hashtagsStr}
              onChange={(e) => setHashtagsStr(e.target.value)}
              placeholder="#LunaraFilm, #Cinema, #Dune"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md"
            >
              Save Post
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
