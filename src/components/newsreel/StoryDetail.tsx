import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Flame, LoaderCircle, Play, RefreshCw, Star } from 'lucide-react';
import { HotTake, NewsStory, Spice } from '../../types';
import { StoryImage } from './StoryCard';
import { DispatchIntegrations, DispatchPanel } from './DispatchPanel';
import { CATEGORY_META, timeAgo } from './wire';

const SPICES: Array<{ id: Spice; label: string }> = [
  { id: 'mild', label: 'Mild' },
  { id: 'hot', label: 'Hot' },
  { id: 'scorching', label: 'Scorching' },
];

const PROVIDER_LABEL: Record<HotTake['provider'], string> = {
  claude: 'Written by Claude',
  gemini: 'Written by Gemini',
  template: 'No model reachable',
};

interface StoryDetailProps {
  story: NewsStory;
  take: HotTake | null;
  takeLoading: boolean;
  takeError: string | null;
  spice: Spice;
  onSpice: (spice: Spice) => void;
  onGetTake: (regenerate?: boolean) => void;
  saved: boolean;
  onToggleSave: () => void;
  integrations: DispatchIntegrations | null;
}

// Tap-to-play: a still until asked, then the official upload via
// youtube-nocookie (no tracking cookies until you press play).
const TrailerPlayer: React.FC<{ story: NewsStory }> = ({ story }) => {
  const [playing, setPlaying] = useState(false);
  useEffect(() => setPlaying(false), [story.id]);
  const trailer = story.trailer!;
  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${trailer.youtubeId}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
        title={trailer.name}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    );
  }
  return (
    <button onClick={() => setPlaying(true)} className="group absolute inset-0 w-full h-full" aria-label={`Play ${trailer.name}`}>
      <img
        key={trailer.youtubeId}
        src={`https://i.ytimg.com/vi/${trailer.youtubeId}/hqdefault.jpg`}
        alt=""
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-16 h-16 rounded-full bg-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,0.45)] flex items-center justify-center group-hover:scale-105 transition-transform">
          <Play className="w-6 h-6 fill-black text-black ml-1" />
        </span>
      </span>
    </button>
  );
};

export const StoryDetail: React.FC<StoryDetailProps> = ({
  story,
  take,
  takeLoading,
  takeError,
  spice,
  onSpice,
  onGetTake,
  saved,
  onToggleSave,
  integrations,
}) => {
  const meta = CATEGORY_META[story.category];
  const when = timeAgo(story.publishedAt);
  const film = story.film;

  return (
    <div className="space-y-6">
      {/* Media */}
      <div>
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-[#050505]">
          {story.trailer ? <TrailerPlayer story={story} /> : <StoryImage story={story} eager />}
        </div>
        <p className="mt-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-600">
          {story.trailer
            ? `Trailer · ${story.trailer.credit} · official channel`
            : story.image
              ? `Image · ${story.image.credit}${story.image.official ? ' · official art' : ''}`
              : 'No art on the wire for this one'}
        </p>
      </div>

      {/* Headline */}
      <div className="space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4AF37]">
          {meta.label}
          <span className="text-zinc-600"> · </span>
          <span className="text-zinc-400">{story.source}</span>
          {when && <span className="text-zinc-600"> · {when} ago</span>}
          {story.coverage > 1 && <span className="text-zinc-500"> · on {story.coverage} outlets</span>}
        </p>
        <h2 className="font-serif text-[2rem] leading-[1.05] text-zinc-50 [text-wrap:balance]">{story.title}</h2>
        {story.author && <p className="text-[11px] text-zinc-500">By {story.author} for {story.source}</p>}
      </div>

      {/* The facts — the outlet's own words, credited */}
      {story.summary && (
        <section className="space-y-1.5">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 not-italic">
            What {story.source} reported
          </h3>
          <p className="text-[14px] leading-relaxed text-zinc-300">{story.summary}</p>
        </section>
      )}

      {/* The take */}
      <section className="relative rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-b from-[#D4AF37]/[0.07] to-transparent p-4 space-y-4 overflow-hidden">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif italic text-xl text-zinc-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#D4AF37]" /> The LUNARA take
          </h3>
          <div role="radiogroup" aria-label="Heat level" className="flex rounded-full border border-zinc-800 bg-black/40 p-0.5">
            {SPICES.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={spice === s.id}
                onClick={() => onSpice(s.id)}
                className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.14em] transition-all ${
                  spice === s.id ? 'bg-[#D4AF37] text-black font-bold' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {take && !take.take && !takeLoading && (
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            No take this time: the hub couldn't reach Claude or Gemini, and a canned line wouldn't sound like you.
            Check that the Claude CLI is logged in (or add a Gemini key), then hit Re-take.
          </p>
        )}

        {take && take.take && !takeLoading && (
          <div className="space-y-3">
            <p className="font-serif italic text-[1.35rem] leading-snug text-amber-50">“{take.take}”</p>
            {take.summary && take.provider !== 'template' && (
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-[0.18em] mr-1.5">Straight</span>
                {take.summary}
              </p>
            )}
            <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-600">
              {PROVIDER_LABEL[take.provider]} · {take.spice}
            </p>
          </div>
        )}

        {takeLoading && (
          <p className="text-[13px] text-zinc-400 flex items-center gap-2">
            <LoaderCircle className="w-4 h-4 animate-spin text-[#D4AF37]" /> Sharpening the knives…
          </p>
        )}
        {takeError && !takeLoading && <p className="text-[12px] text-amber-300">{takeError}</p>}

        <button
          onClick={() => onGetTake(Boolean(take && take.spice === spice))}
          disabled={takeLoading}
          className="w-full py-2.5 rounded-xl border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black text-[11px] font-bold uppercase tracking-[0.18em] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {take ? <RefreshCw className="w-3.5 h-3.5" /> : <Flame className="w-3.5 h-3.5" />}
          {!take
            ? 'Get the take'
            : take.spice === spice
              ? 'Re-take'
              : `Turn it ${SPICES.findIndex((s) => s.id === spice) > SPICES.findIndex((s) => s.id === take.spice) ? 'up' : 'down'}`}
        </button>
      </section>

      {/* About the film (TMDB) */}
      {film && (
        <section className="flex gap-3.5 p-3 rounded-2xl border border-zinc-800 bg-[#050505]">
          {film.poster && (
            <img
              src={film.poster}
              alt={`${film.title} poster`}
              referrerPolicy="no-referrer"
              className="w-16 h-24 rounded-lg object-cover border border-zinc-800 shrink-0"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="font-serif text-lg text-zinc-100 leading-tight">
              {film.title}
              {film.year && <span className="text-zinc-500"> ({film.year})</span>}
            </p>
            {film.releaseDate && (
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
                Release {new Date(`${film.releaseDate}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                {film.studio && ` · ${film.studio}`}
              </p>
            )}
            {film.overview && <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-3">{film.overview}</p>}
            <a href={film.tmdbUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500 hover:text-[#D4AF37]">
              TMDB <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </section>
      )}

      {/* Dispatch */}
      <section className="space-y-3">
        <h3 className="font-serif italic text-xl text-zinc-100">Dispatch</h3>
        <DispatchPanel story={story} take={take} integrations={integrations} />
      </section>

      {/* Exits */}
      <div className="flex flex-wrap gap-2 pb-2">
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 min-w-[9rem] py-2.5 rounded-xl border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 text-[11px] font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-1.5"
        >
          {story.kind === 'trailers' ? 'Watch on YouTube' : `Read at ${story.source}`} <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
        {story.trailer && story.kind !== 'trailers' && (
          <a
            href={story.trailer.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-w-[9rem] py-2.5 rounded-xl border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600 text-[11px] font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-1.5"
          >
            Trailer on YouTube <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        )}
        <button
          onClick={onToggleSave}
          aria-pressed={saved}
          className={`flex-1 min-w-[9rem] py-2.5 rounded-xl border text-[11px] font-mono uppercase tracking-[0.14em] flex items-center justify-center gap-1.5 transition-all ${
            saved ? 'border-[#D4AF37]/70 text-[#D4AF37] bg-[#D4AF37]/10' : 'border-zinc-800 text-zinc-300 hover:border-zinc-600'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${saved ? 'fill-[#D4AF37]' : ''}`} /> {saved ? 'On the shortlist' : 'Shortlist it'}
        </button>
      </div>
    </div>
  );
};
