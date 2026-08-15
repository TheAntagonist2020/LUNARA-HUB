import React, { useState } from 'react';
import { FilmJournalEntry } from '../types';
import { Star, Sparkles, Plus, Search, Tag, ExternalLink, Film, Trash2, Edit3, Quote, BookOpen, Sliders, Video, Cpu, ChevronDown, ChevronUp } from 'lucide-react';

interface FilmJournalProps {
  entries: FilmJournalEntry[];
  onOpenNewJournal: () => void;
  onEditJournal: (entry: FilmJournalEntry) => void;
  onDeleteJournal: (id: string) => void;
  onSelectJournalForAI: (entry: FilmJournalEntry) => void;
}

export const FilmJournal: React.FC<FilmJournalProps> = ({
  entries,
  onOpenNewJournal,
  onEditJournal,
  onDeleteJournal,
  onSelectJournalForAI,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
  const [selectedSection, setSelectedSection] = useState<string | 'all'>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Extract all unique tags & sections
  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags || [])));
  const allSections = Array.from(new Set(entries.map((e) => e.section).filter(Boolean)));

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      searchQuery === '' ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.director.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.reviewText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'all' || entry.tags?.includes(selectedTag);
    const matchesSection = selectedSection === 'all' || entry.section === selectedSection;
    const matchesRating = entry.rating >= minRating;
    return matchesSearch && matchesTag && matchesSection && matchesRating;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0a0a0a] p-6 rounded-xl border border-zinc-800 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <BookOpen className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
              LUNARA JOURNAL CONTROL PLANE
            </span>
          </div>
          <h2 className="font-serif italic text-2xl md:text-3xl font-bold text-zinc-100">
            The Lunara Journal
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Critical film editorial notebook, signal notes, essay overrides, and trailer metadata. Directly synchronized with Gemini AI synthesis.
          </p>
        </div>

        <button
          onClick={onOpenNewJournal}
          className="flex items-center gap-2 px-5 py-2.5 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          + New Journal Entry
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#0a0a0a]/90 p-4 rounded-xl border border-zinc-800">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, director, signal notes..."
            className="w-full bg-[#050505] border border-zinc-800 rounded pl-9 pr-4 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Section Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-zinc-800 text-xs">
            <span className="text-zinc-500 font-mono text-[9px] px-2 uppercase">SECTION:</span>
            <button
              onClick={() => setSelectedSection('all')}
              className={`px-2 py-0.5 rounded text-[11px] ${selectedSection === 'all' ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedSection('Signal')}
              className={`px-2 py-0.5 rounded text-[11px] ${selectedSection === 'Signal' ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Signal
            </button>
            <button
              onClick={() => setSelectedSection('Awards Season')}
              className={`px-2 py-0.5 rounded text-[11px] ${selectedSection === 'Awards Season' ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Awards
            </button>
            <button
              onClick={() => setSelectedSection('Casting & Production')}
              className={`px-2 py-0.5 rounded text-[11px] ${selectedSection === 'Casting & Production' ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Casting
            </button>
          </div>

          {/* Rating Filter */}
          <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-zinc-800 text-xs">
            <span className="text-zinc-500 font-mono text-[9px] px-2 uppercase">RATING:</span>
            <button
              onClick={() => setMinRating(0)}
              className={`px-2 py-0.5 rounded text-[11px] ${minRating === 0 ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400'}`}
            >
              All
            </button>
            <button
              onClick={() => setMinRating(4)}
              className={`px-2 py-0.5 rounded text-[11px] ${minRating === 4 ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400'}`}
            >
              ★ 4.0+
            </button>
            <button
              onClick={() => setMinRating(5)}
              className={`px-2 py-0.5 rounded text-[11px] ${minRating === 5 ? 'bg-zinc-800 text-[#D4AF37] font-bold' : 'text-zinc-400'}`}
            >
              ★ 5.0
            </button>
          </div>

        </div>

      </div>

      {/* Film Entries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEntries.map((entry) => {
          const isExpanded = expandedEntryId === entry.id;

          return (
            <div
              key={entry.id}
              className="bg-[#0a0a0a] rounded-xl border border-zinc-800 hover:border-[#D4AF37]/50 transition-all overflow-hidden flex flex-col justify-between group shadow-xl"
            >
              {/* Poster Header */}
              <div className="relative h-64 overflow-hidden">
                <img
                  src={entry.posterUrl}
                  alt={entry.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />

                {/* Section Badge */}
                <div className="absolute top-3 left-3 bg-[#050505]/90 backdrop-blur-md px-2.5 py-1 rounded border border-zinc-700/80 flex items-center gap-1.5 text-zinc-300 font-mono text-[10px] uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                  <span>{entry.section || 'Journal Signal'}</span>
                </div>

                {/* Star Rating Overlay */}
                <div className="absolute top-3 right-3 bg-[#050505]/90 backdrop-blur-md px-3 py-1 rounded border border-[#D4AF37]/40 flex items-center gap-1.5 text-[#D4AF37] font-bold text-xs shadow-lg">
                  <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                  <span>{entry.rating.toFixed(1)}</span>
                </div>

                {/* Title & Director */}
                <div className="absolute bottom-3 left-4 right-4 space-y-1">
                  <h3 className="font-serif italic font-bold text-xl text-zinc-100 leading-snug">
                    {entry.title}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Directed by <strong className="text-zinc-200 font-normal">{entry.director}</strong> ({entry.year})
                  </p>
                </div>
              </div>

              {/* Entry Content Body */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                
                {/* Quote */}
                {entry.favoriteQuote && (
                  <div className="p-3 rounded bg-[#050505] border border-zinc-800/80 flex items-start gap-2.5 text-xs italic text-zinc-300">
                    <Quote className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                    <span>"{entry.favoriteQuote}"</span>
                  </div>
                )}

                {/* Review Text */}
                <p className="text-xs text-zinc-300 leading-relaxed font-serif">
                  {entry.reviewText}
                </p>

                {/* Tags */}
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {entry.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[#050505] text-zinc-400 border border-zinc-800"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Expandable CMS Details Drawer */}
                <div className="pt-2">
                  <button
                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-[#D4AF37] py-1.5 px-2 bg-[#050505] rounded border border-zinc-800 transition-all"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-[#D4AF37]" />
                      Lunara Editorial Control Plane
                    </span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-3 bg-[#050505] rounded border border-zinc-800 text-[11px] space-y-2 font-mono text-zinc-300 animate-fadeIn">
                      <div className="flex justify-between border-b border-zinc-800 pb-1">
                        <span className="text-zinc-500 uppercase text-[9px]">Signal Kicker:</span>
                        <span className="text-[#D4AF37]">{entry.signalOverrides?.signalContextKicker || 'SIGNAL NOTE'}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-800 pb-1">
                        <span className="text-zinc-500 uppercase text-[9px]">CTA Label:</span>
                        <span>{entry.signalOverrides?.journalCtaLabel || 'Read Full Essay'}</span>
                      </div>
                      {entry.trailerInfo?.trailerUrl && (
                        <div className="flex justify-between border-b border-zinc-800 pb-1">
                          <span className="text-zinc-500 uppercase text-[9px]">Trailer Credit:</span>
                          <span className="text-sky-400 truncate max-w-[150px]">{entry.trailerInfo.sourceCredit || 'Official Trailer'}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1">
                        <span className="text-zinc-500 uppercase text-[9px]">AI Model:</span>
                        <span className="text-emerald-400">{entry.provenance?.model || 'gemini-2.5-flash'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Toolbar */}
                <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-mono text-[10px]">Logged: {entry.dateWatched}</span>
                    {entry.articleUrl && (
                      <a
                        href={entry.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#D4AF37] hover:underline flex items-center gap-1 text-[11px]"
                      >
                        Lunara Journal <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => onSelectJournalForAI(entry)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-zinc-800 hover:bg-[#D4AF37] hover:text-black text-zinc-200 font-mono uppercase text-[10px] tracking-wider transition-all shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Synthesize Campaign
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditJournal(entry)}
                        title="Edit journal entry"
                        className="p-2 rounded bg-[#050505] border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteJournal(entry.id)}
                        title="Delete journal entry"
                        className="p-2 rounded bg-[#050505] border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-900/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

