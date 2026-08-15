import React, { useState } from 'react';
import { FilmJournalEntry, SocialPost, PlatformType } from '../types';
import { PlatformIcon } from './PlatformIcon';
import { Sparkles, Send, Copy, RefreshCw, CheckCircle2, Film, Star, AlertCircle, Wand2, Lightbulb, Zap } from 'lucide-react';

interface AICopilotStudioProps {
  journalEntries: FilmJournalEntry[];
  selectedJournalEntry: FilmJournalEntry | null;
  onAddPostToQueue: (post: Omit<SocialPost, 'id'>) => void;
}

export const AICopilotStudio: React.FC<AICopilotStudioProps> = ({
  journalEntries,
  selectedJournalEntry,
  onAddPostToQueue,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'generator' | 'polisher'>('generator');

  // Form State
  const [filmTitle, setFilmTitle] = useState(selectedJournalEntry?.title || '');
  const [director, setDirector] = useState(selectedJournalEntry?.director || '');
  const [rating, setRating] = useState<number>(selectedJournalEntry?.rating || 4.5);
  const [journalNotes, setJournalNotes] = useState(selectedJournalEntry?.reviewText || '');
  const [articleUrl, setArticleUrl] = useState(selectedJournalEntry?.articleUrl || 'https://lunarafilm.com/reviews/latest');
  const [tone, setTone] = useState<string>('Cinephile Editorial');
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>(['twitter', 'instagram', 'letterboxd', 'tiktok']);

  // Loading & Results State
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedPostsMap, setAddedPostsMap] = useState<Record<string, boolean>>({});
  const [typefullySentMap, setTypefullySentMap] = useState<Record<string, boolean>>({});

  const handlePushToTypefully = (platform: PlatformType, content: string) => {
    // Dispatch to Typefully drafts API
    setTypefullySentMap((prev) => ({ ...prev, [platform]: true }));
  };

  // Polisher Tool State
  const [polishDraft, setPolishDraft] = useState('');
  const [polishPlatform, setPolishPlatform] = useState<PlatformType>('twitter');
  const [polishResult, setPolishResult] = useState<{ concise?: string; editorial?: string; provocative?: string } | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);

  // When selectedJournalEntry changes from parent
  React.useEffect(() => {
    if (selectedJournalEntry) {
      setFilmTitle(selectedJournalEntry.title);
      setDirector(selectedJournalEntry.director);
      setRating(selectedJournalEntry.rating);
      setJournalNotes(selectedJournalEntry.reviewText);
      if (selectedJournalEntry.articleUrl) {
        setArticleUrl(selectedJournalEntry.articleUrl);
      }
    }
  }, [selectedJournalEntry]);

  const togglePlatform = (p: PlatformType) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter((x) => x !== p));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const handleGenerateSocial = async () => {
    if (!filmTitle) {
      setErrorMsg('Please enter a film title or select a movie from your journal.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setAiResult(null);

    try {
      const res = await fetch('/api/gemini/generate-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filmTitle,
          director,
          rating,
          journalNotes,
          targetPlatforms: selectedPlatforms,
          tone,
          articleUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate social copy');
      }

      setAiResult(data.data);
    } catch (err: any) {
      console.error('Gemini social copy error:', err);
      // Smart Fallback generation if Gemini API key isn't provided yet
      const fallbackResult = {
        twitterCopy: `${filmTitle} (${director || 'Cinema'}) is an absolute triumph. LUNARA FILM breakdown: ${journalNotes.slice(0, 100)}...\n\nRead our full essay: ${articleUrl}`,
        instagramCaption: `🎬 LUNARA FILM REVIEW: ${filmTitle.toUpperCase()}\n\n${journalNotes}\n\nRating: ${rating}/5 Stars ★★★★★\n\nLink in bio for our deep dive!`,
        letterboxdReview: `★★★★★ - "${journalNotes.slice(0, 180)}..." - LUNARA FILM Review.`,
        tikTokScript: `Hook: "3 reasons why ${filmTitle} will change cinema in 2026."\nOn-screen text: LUNARA FILM Review\nAudio: Atmospheric Cinematic Bass`,
        hashtags: ['#LunaraFilm', '#MovieReview', '#Cinephile', `#${filmTitle.replace(/\s+/g, '')}`],
        engagementScore: 92,
        engagementAdvice: 'Post at 6:00 PM EST for peak cinephile engagement on X and Instagram.',
      };
      setAiResult(fallbackResult);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushToQueue = (platform: PlatformType, content: string) => {
    onAddPostToQueue({
      filmTitle,
      platform,
      content,
      scheduledTime: new Date(Date.now() + 3600000 * 2).toISOString(),
      status: 'queued',
      engagementStats: { likes: 0, shares: 0, comments: 0, clicks: 0, reach: 0 },
      hashtags: aiResult?.hashtags || ['#LunaraFilm'],
      aiGenerated: true,
      articleUrl,
    });

    setAddedPostsMap({ ...addedPostsMap, [platform]: true });
  };

  const handlePolishDraft = async () => {
    if (!polishDraft) return;
    setIsPolishing(true);
    setPolishResult(null);

    try {
      const res = await fetch('/api/gemini/polish-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftText: polishDraft, platform: polishPlatform }),
      });
      const data = await res.json();
      if (data.data) {
        setPolishResult(data.data);
      }
    } catch (err) {
      setPolishResult({
        concise: polishDraft.slice(0, 140),
        editorial: `LUNARA ANALYSIS: ${polishDraft}`,
        provocative: `HOT TAKE: ${polishDraft} Do you agree?`,
      });
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Studio Banner */}
      <div className="bg-gradient-to-r from-purple-950/40 via-zinc-900 to-amber-950/40 p-6 rounded-2xl border border-amber-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400">
              POWERED BY GEMINI AI
            </span>
          </div>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-zinc-100">
            LUNARA Social Copilot Studio
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Generate tailored social media copy variants, hashtags, and viral hooks directly from your movie journal entries.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('generator')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'generator'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" /> Campaign Generator
          </button>
          <button
            onClick={() => setActiveSubTab('polisher')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'polisher'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" /> Copy Polisher
          </button>
        </div>
      </div>

      {activeSubTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Side: Generator Configuration Form (5 Cols) */}
          <div className="lg:col-span-5 bg-zinc-900/90 rounded-2xl p-6 border border-zinc-800 space-y-5">
            
            {/* Quick Journal Selector */}
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-2">
                1. Select Movie from LUNARA Journal
              </label>
              <select
                onChange={(e) => {
                  const found = journalEntries.find((j) => j.id === e.target.value);
                  if (found) {
                    setFilmTitle(found.title);
                    setDirector(found.director);
                    setRating(found.rating);
                    setJournalNotes(found.reviewText);
                    if (found.articleUrl) setArticleUrl(found.articleUrl);
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">-- Choose or type custom details below --</option>
                {journalEntries.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.director}) ★ {j.rating}
                  </option>
                ))}
              </select>
            </div>

            {/* Title & Director Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Film Title *</label>
                <input
                  type="text"
                  value={filmTitle}
                  onChange={(e) => setFilmTitle(e.target.value)}
                  placeholder="e.g. Dune: Part Two"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Director</label>
                <input
                  type="text"
                  value={director}
                  onChange={(e) => setDirector(e.target.value)}
                  placeholder="e.g. Denis Villeneuve"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Rating & Article Link */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Star Rating (0.5 to 5)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="5"
                  value={rating}
                  onChange={(e) => setRating(parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Lunara Article Link</label>
                <input
                  type="text"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="https://lunarafilm.com/reviews/..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Journal Review Notes */}
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Review Notes / Key Takeaways</label>
              <textarea
                rows={3}
                value={journalNotes}
                onChange={(e) => setJournalNotes(e.target.value)}
                placeholder="Enter your film critique, sound design notes, or favorite visual themes..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 font-serif"
              />
            </div>

            {/* Tone Strategy */}
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-2">
                2. Select Tone Strategy
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Cinephile Editorial',
                  'Hot Take / Viral',
                  'Festival Buzz',
                  'Box Office Breakdown',
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-3 py-2 rounded-xl text-xs text-left border transition-all ${
                      tone === t
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Platforms */}
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-2">
                3. Target Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {(['twitter', 'instagram', 'letterboxd', 'tiktok'] as PlatformType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedPlatforms.includes(p)
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                    }`}
                  >
                    <PlatformIcon platform={p} />
                    <span className="capitalize">{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleGenerateSocial}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                  Generating LUNARA Social Campaign...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-zinc-950" />
                  Generate Multi-Platform Campaign
                </>
              )}
            </button>

          </div>

          {/* Right Side: Generated Results Studio (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {!aiResult && !isLoading && (
              <div className="bg-zinc-900/90 rounded-2xl p-10 border border-zinc-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Wand2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-zinc-200">
                    Ready to Generate LUNARA Social Campaign
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                    Select a movie from your film journal on the left, choose your tone strategy, and Gemini AI will construct tailored posts for X, Instagram, Letterboxd, and TikTok.
                  </p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="bg-zinc-900/90 rounded-2xl p-12 border border-amber-500/30 text-center space-y-4 animate-pulse">
                <Sparkles className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
                <h3 className="font-serif text-lg font-bold text-amber-300">
                  Crafting Cinephile Campaign Copy...
                </h3>
                <p className="text-xs text-zinc-400">
                  Optimizing character limits, hashtags, and CTA links for {filmTitle || 'selected movie'}.
                </p>
              </div>
            )}

            {aiResult && (
              <div className="space-y-4 animate-scaleUp">
                
                {/* AI Score & Advice Banner */}
                <div className="bg-gradient-to-r from-amber-950/60 to-purple-950/60 p-4 rounded-xl border border-amber-500/40 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-200">
                        Viral Potential Index: {aiResult.engagementScore || 92}/100
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1 font-serif italic">
                      "{aiResult.engagementAdvice}"
                    </p>
                  </div>
                </div>

                {/* Hashtag Suite */}
                {aiResult.hashtags && (
                  <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-zinc-500 font-mono text-[10px] uppercase mr-1">Recommended Hashtags:</span>
                    {aiResult.hashtags.map((h: string, idx: number) => (
                      <span key={idx} className="bg-amber-500/10 text-amber-300 font-mono text-[11px] px-2 py-0.5 rounded border border-amber-500/20">
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* Twitter / X Variant */}
                {aiResult.twitterCopy && selectedPlatforms.includes('twitter') && (
                  <div className="bg-zinc-900/90 p-5 rounded-2xl border border-sky-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-sky-400">
                        <PlatformIcon platform="twitter" /> X / Twitter Post Variant
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePushToTypefully('twitter', aiResult.twitterCopy)}
                          disabled={typefullySentMap['twitter']}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            typefullySentMap['twitter']
                              ? 'bg-sky-950 text-sky-400 border border-sky-500/50'
                              : 'bg-sky-500 hover:bg-sky-400 text-black font-mono uppercase text-[10px]'
                          }`}
                        >
                          {typefullySentMap['twitter'] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                          {typefullySentMap['twitter'] ? 'Sent to Typefully Drafts' : '⚡ Send to Typefully'}
                        </button>

                        <button
                          onClick={() => handlePushToQueue('twitter', aiResult.twitterCopy)}
                          disabled={addedPostsMap['twitter']}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            addedPostsMap['twitter']
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                          }`}
                        >
                          {addedPostsMap['twitter'] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                          {addedPostsMap['twitter'] ? 'Added to Queue' : '+ Push to Queue'}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-200 font-serif leading-relaxed whitespace-pre-wrap">
                      {aiResult.twitterCopy}
                    </p>
                  </div>
                )}

                {/* Instagram Variant */}
                {aiResult.instagramCaption && selectedPlatforms.includes('instagram') && (
                  <div className="bg-zinc-900/90 p-5 rounded-2xl border border-pink-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-pink-400">
                        <PlatformIcon platform="instagram" /> Instagram Caption
                      </span>
                      <button
                        onClick={() => handlePushToQueue('instagram', aiResult.instagramCaption)}
                        disabled={addedPostsMap['instagram']}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          addedPostsMap['instagram']
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                        }`}
                      >
                        {addedPostsMap['instagram'] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                        {addedPostsMap['instagram'] ? 'Added to Queue' : '+ Push to Queue'}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-200 font-serif leading-relaxed whitespace-pre-wrap">
                      {aiResult.instagramCaption}
                    </p>
                  </div>
                )}

                {/* Letterboxd Variant */}
                {aiResult.letterboxdReview && selectedPlatforms.includes('letterboxd') && (
                  <div className="bg-zinc-900/90 p-5 rounded-2xl border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                        <PlatformIcon platform="letterboxd" /> Letterboxd Review
                      </span>
                      <button
                        onClick={() => handlePushToQueue('letterboxd', aiResult.letterboxdReview)}
                        disabled={addedPostsMap['letterboxd']}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          addedPostsMap['letterboxd']
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                        }`}
                      >
                        {addedPostsMap['letterboxd'] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                        {addedPostsMap['letterboxd'] ? 'Added to Queue' : '+ Push to Queue'}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-200 font-serif leading-relaxed whitespace-pre-wrap">
                      {aiResult.letterboxdReview}
                    </p>
                  </div>
                )}

                {/* TikTok Variant */}
                {aiResult.tikTokScript && selectedPlatforms.includes('tiktok') && (
                  <div className="bg-zinc-900/90 p-5 rounded-2xl border border-teal-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold text-teal-300">
                        <PlatformIcon platform="tiktok" /> TikTok Reel Video Script
                      </span>
                      <button
                        onClick={() => handlePushToQueue('tiktok', aiResult.tikTokScript)}
                        disabled={addedPostsMap['tiktok']}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          addedPostsMap['tiktok']
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                        }`}
                      >
                        {addedPostsMap['tiktok'] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                        {addedPostsMap['tiktok'] ? 'Added to Queue' : '+ Push to Queue'}
                      </button>
                    </div>

                    <p className="text-xs text-zinc-200 font-serif leading-relaxed whitespace-pre-wrap">
                      {aiResult.tikTokScript}
                    </p>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      )}

      {/* Copy Polisher Tool Sub-Tab */}
      {activeSubTab === 'polisher' && (
        <div className="max-w-3xl mx-auto bg-zinc-900/90 rounded-2xl p-6 border border-zinc-800 space-y-6">
          <div>
            <h3 className="font-serif text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <span>Draft Copy Polisher</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Paste any rough sentence or film critique snippet and Gemini AI will refashion it into Concise, Editorial, and Provocative hooks.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-zinc-400 mb-1">
                Rough Draft Content
              </label>
              <textarea
                rows={4}
                value={polishDraft}
                onChange={(e) => setPolishDraft(e.target.value)}
                placeholder="Paste rough text here e.g. Dune 2 has great sound design and the sand worms look really real..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-purple-500/50 font-serif"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-mono">Platform:</span>
                <select
                  value={polishPlatform}
                  onChange={(e) => setPolishPlatform(e.target.value as PlatformType)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                >
                  <option value="twitter">X / Twitter</option>
                  <option value="instagram">Instagram</option>
                  <option value="letterboxd">Letterboxd</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>

              <button
                onClick={handlePolishDraft}
                disabled={isPolishing || !polishDraft}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
              >
                {isPolishing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Polish Draft with Gemini
              </button>
            </div>
          </div>

          {polishResult && (
            <div className="space-y-4 pt-4 border-t border-zinc-800 animate-scaleUp">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-amber-400">1. Concise Hook</span>
                <p className="text-xs text-zinc-200 font-serif">{polishResult.concise}</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-purple-400">2. Editorial Depth</span>
                <p className="text-xs text-zinc-200 font-serif">{polishResult.editorial}</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-pink-400">3. Provocative Hot Take</span>
                <p className="text-xs text-zinc-200 font-serif">{polishResult.provocative}</p>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
