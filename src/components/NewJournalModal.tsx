import React, { useState } from 'react';
import { FilmJournalEntry } from '../types';
import { X, Star, BookOpen, Film, Radio, Video, Cpu, Sliders, Check } from 'lucide-react';

interface NewJournalModalProps {
  entryToEdit?: FilmJournalEntry | null;
  onSave: (entryData: Partial<FilmJournalEntry>) => void;
  onClose: () => void;
}

export const NewJournalModal: React.FC<NewJournalModalProps> = ({
  entryToEdit,
  onSave,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'core' | 'cms' | 'trailer' | 'provenance'>('core');

  // Core Fields
  const [title, setTitle] = useState(entryToEdit?.title || '');
  const [director, setDirector] = useState(entryToEdit?.director || '');
  const [year, setYear] = useState<number>(entryToEdit?.year || new Date().getFullYear());
  const [posterUrl, setPosterUrl] = useState(entryToEdit?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop');
  const [rating, setRating] = useState<number>(entryToEdit?.rating || 4.5);
  const [reviewText, setReviewText] = useState(entryToEdit?.reviewText || '');
  const [favoriteQuote, setFavoriteQuote] = useState(entryToEdit?.favoriteQuote || '');
  const [tagsStr, setTagsStr] = useState(entryToEdit?.tags ? entryToEdit.tags.join(', ') : 'Signal, Auteur');
  const [articleUrl, setArticleUrl] = useState(entryToEdit?.articleUrl || 'https://lunarafilm.com/reviews/latest');

  // Lunara Journal CMS Fields
  const [section, setSection] = useState<'Signal' | 'Awards Season' | 'Box Office' | 'Casting & Production' | 'News' | 'Physical Media' | 'Streaming'>(
    entryToEdit?.section || 'Signal'
  );
  const [featureOnHomepage, setFeatureOnHomepage] = useState<boolean>(entryToEdit?.featureOnHomepage ?? true);
  const [featurePriority, setFeaturePriority] = useState<number>(entryToEdit?.featurePriority || 1);

  // Signal Overrides
  const [signalContextKicker, setSignalContextKicker] = useState(entryToEdit?.signalOverrides?.signalContextKicker || 'SIGNAL NOTE');
  const [articleDetailsKicker, setArticleDetailsKicker] = useState(entryToEdit?.signalOverrides?.articleDetailsKicker || 'LUNARA EDITORIAL');
  const [journalCtaLabel, setJournalCtaLabel] = useState(entryToEdit?.signalOverrides?.journalCtaLabel || 'Read Full Essay on Lunara Film');
  const [journalCtaUrl, setJournalCtaUrl] = useState(entryToEdit?.signalOverrides?.journalCtaUrl || 'https://lunarafilm.com/journal');
  const [hideHeroMedia, setHideHeroMedia] = useState<boolean>(entryToEdit?.signalOverrides?.hideHeroMedia || false);

  // Trailer Info
  const [trailerUrl, setTrailerUrl] = useState(entryToEdit?.trailerInfo?.trailerUrl || 'https://youtube.com/watch?v=sample');
  const [trailerPlacement, setTrailerPlacement] = useState<'After first paragraph' | 'Hero' | 'Footer'>(
    entryToEdit?.trailerInfo?.trailerPlacement || 'After first paragraph'
  );
  const [trailerLabel, setTrailerLabel] = useState(entryToEdit?.trailerInfo?.trailerLabel || 'Official Teaser Trailer');
  const [sourceCredit, setSourceCredit] = useState(entryToEdit?.trailerInfo?.sourceCredit || 'Universal Pictures / A24');
  const [editorialNote, setEditorialNote] = useState(entryToEdit?.trailerInfo?.editorialNote || 'Key cinematic milestone to track this season.');

  // Provenance
  const [configVersion, setConfigVersion] = useState(entryToEdit?.provenance?.configVersion || '1.0.19');
  const [promptVersion, setPromptVersion] = useState(entryToEdit?.provenance?.promptVersion || 'journal-1.0.19');
  const [provider, setProvider] = useState(entryToEdit?.provenance?.provider || 'gemini');
  const [model, setModel] = useState(entryToEdit?.provenance?.model || 'gemini-2.5-flash');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !reviewText.trim()) return;

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onSave({
      ...(entryToEdit ? { id: entryToEdit.id } : {}),
      title,
      director,
      year: Number(year),
      posterUrl,
      rating: Number(rating),
      reviewText,
      favoriteQuote: favoriteQuote || undefined,
      tags,
      articleUrl: articleUrl || undefined,
      status: entryToEdit?.status || 'logged',
      dateWatched: entryToEdit?.dateWatched || new Date().toISOString().split('T')[0],
      section,
      featureOnHomepage,
      featurePriority,
      signalOverrides: {
        signalContextKicker,
        articleDetailsKicker,
        journalCtaLabel,
        journalCtaUrl,
        hideHeroMedia,
      },
      trailerInfo: {
        trailerUrl,
        trailerPlacement,
        trailerLabel,
        sourceCredit,
        editorialNote,
      },
      provenance: {
        configVersion,
        promptVersion,
        provider,
        model,
        generatedAtGMT: new Date().toISOString().replace('T', ' ').substring(0, 19),
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] rounded-xl border border-zinc-800 max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-scaleUp text-zinc-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.2em] font-mono px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                LUNARA JOURNAL CONTROL PLANE
              </span>
            </div>
            <h3 className="font-serif italic text-2xl font-bold text-zinc-100 mt-1">
              {entryToEdit ? `Edit: ${entryToEdit.title}` : 'New Lunara Journal Entry'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('core')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'core'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Editorial Review
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cms')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'cms'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Signal Controls
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trailer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'trailer'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Lunara Trailer
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('provenance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'provenance'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Provenance
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* TAB 1: CORE EDITORIAL REVIEW */}
          {activeTab === 'core' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Film Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Dune: Part Two"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Director</label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    placeholder="e.g. Denis Villeneuve"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Release Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Star Rating (0.5 to 5.0)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(parseFloat(e.target.value))}
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Poster / Header Image URL</label>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Lunara Editorial Critique *</label>
                <textarea
                  rows={4}
                  required
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write your main film journal essay or signal critique..."
                  className="w-full bg-[#050505] border border-zinc-800 rounded p-3 text-zinc-200 focus:outline-none focus:border-[#D4AF37] font-serif leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Standout Dialogue Quote</label>
                  <input
                    type="text"
                    value={favoriteQuote}
                    onChange={(e) => setFavoriteQuote(e.target.value)}
                    placeholder='"May thy knife chip..."'
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Tags (Comma Separated)</label>
                  <input
                    type="text"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="Signal, Sci-Fi, IMAX"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">LUNARA Website Review URL</label>
                <input
                  type="text"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="https://lunarafilm.com/reviews/..."
                  className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: SIGNAL & CMS CONTROLS */}
          {activeTab === 'cms' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Journal Section</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as any)}
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="Signal">Signal</option>
                    <option value="Awards Season">Awards Season</option>
                    <option value="Box Office">Box Office</option>
                    <option value="Casting & Production">Casting & Production</option>
                    <option value="News">News</option>
                    <option value="Physical Media">Physical Media</option>
                    <option value="Streaming">Streaming</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Signal Context Kicker</label>
                  <input
                    type="text"
                    value={signalContextKicker}
                    onChange={(e) => setSignalContextKicker(e.target.value)}
                    placeholder="e.g. CASTING & PRODUCTION"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Article Details Kicker</label>
                  <input
                    type="text"
                    value={articleDetailsKicker}
                    onChange={(e) => setArticleDetailsKicker(e.target.value)}
                    placeholder="e.g. LUNARA EDITORIAL"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Journal CTA Label</label>
                  <input
                    type="text"
                    value={journalCtaLabel}
                    onChange={(e) => setJournalCtaLabel(e.target.value)}
                    placeholder="Read Full Essay"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Journal CTA URL Override</label>
                <input
                  type="text"
                  value={journalCtaUrl}
                  onChange={(e) => setJournalCtaUrl(e.target.value)}
                  placeholder="https://lunarafilm.com/..."
                  className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featureOnHomepage}
                    onChange={(e) => setFeatureOnHomepage(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#D4AF37]"
                  />
                  <span className="text-zinc-200 font-semibold text-xs">Feature on LUNARA Homepage Hero</span>
                </label>

                {featureOnHomepage && (
                  <div>
                    <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Feature Priority (0 = highest)</label>
                    <input
                      type="number"
                      value={featurePriority}
                      onChange={(e) => setFeaturePriority(parseInt(e.target.value))}
                      className="w-32 bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={hideHeroMedia}
                    onChange={(e) => setHideHeroMedia(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#D4AF37]"
                  />
                  <span className="text-zinc-300 text-xs">Hide Hero Media on Single Post View</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: LUNARA TRAILER */}
          {activeTab === 'trailer' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Trailer Embed URL (YouTube or Vimeo)</label>
                <input
                  type="text"
                  value={trailerUrl}
                  onChange={(e) => setTrailerUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Trailer Placement</label>
                  <select
                    value={trailerPlacement}
                    onChange={(e) => setTrailerPlacement(e.target.value as any)}
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="After first paragraph">After first paragraph</option>
                    <option value="Hero">Hero / Header</option>
                    <option value="Footer">Footer / Bottom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Trailer Label</label>
                  <input
                    type="text"
                    value={trailerLabel}
                    onChange={(e) => setTrailerLabel(e.target.value)}
                    placeholder="Official Trailer"
                    className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Source / Credit</label>
                <input
                  type="text"
                  value={sourceCredit}
                  onChange={(e) => setSourceCredit(e.target.value)}
                  placeholder="Universal Pictures / Studio Channel"
                  className="w-full bg-[#050505] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Editorial Note on Trailer</label>
                <textarea
                  rows={2}
                  value={editorialNote}
                  onChange={(e) => setEditorialNote(e.target.value)}
                  placeholder="One sentence explaining why this trailer or teaser matters..."
                  className="w-full bg-[#050505] border border-zinc-800 rounded p-3 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
          )}

          {/* TAB 4: PROVENANCE */}
          {activeTab === 'provenance' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-3 font-mono text-[11px]">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-zinc-500 uppercase">Configuration Version</span>
                  <input
                    type="text"
                    value={configVersion}
                    onChange={(e) => setConfigVersion(e.target.value)}
                    className="bg-[#0a0a0a] border border-zinc-800 text-right text-[#D4AF37] rounded px-2 py-0.5 w-32"
                  />
                </div>

                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-zinc-500 uppercase">Prompt Version</span>
                  <input
                    type="text"
                    value={promptVersion}
                    onChange={(e) => setPromptVersion(e.target.value)}
                    className="bg-[#0a0a0a] border border-zinc-800 text-right text-zinc-300 rounded px-2 py-0.5 w-40"
                  />
                </div>

                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-zinc-500 uppercase">AI Synthesizer Engine</span>
                  <span className="text-emerald-400 font-bold">Google Gemini AI</span>
                </div>

                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <span className="text-zinc-500 uppercase">Active Model</span>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-[#0a0a0a] border border-zinc-800 text-right text-zinc-300 rounded px-2 py-0.5 w-40"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 uppercase">Provenance System Status</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> VERIFIED</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500">
              LUNARA JOURNAL CMS • V1.0.19
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-xs transition-all uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md"
              >
                Save Lunara Journal Entry
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

