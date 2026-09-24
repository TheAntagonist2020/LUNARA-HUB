import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { Flame, Play, Radio } from 'lucide-react';
import { HotTake, NewsStory } from '../../types';
import { CATEGORY_META, isFresh, timeAgo } from './wire';

export interface StoryCardHandle {
  fling: (dir: 1 | -1) => void;
}

interface StoryCardProps {
  story: NewsStory;
  take?: HotTake | null;
  depth: number; // 0 = the card on top of the deck
  enterFrom?: 1 | -1 | 0; // slides back in from this side after an undo
  onDecide: (dir: 1 | -1) => void;
  onOpen: () => void;
}

const SWIPE_POWER = 120;

// Typographic stand-in for stories with no usable art — never a stock photo.
export const PosterFallback: React.FC<{ story: NewsStory; className?: string }> = ({ story, className = '' }) => (
  <div className={`relative w-full h-full overflow-hidden bg-[#0b0b0d] ${className}`}>
    <div aria-hidden className="absolute -top-1/4 -left-1/4 w-[120%] h-[90%] rounded-full bg-[#D4AF37]/[0.09] blur-3xl" />
    <div aria-hidden className="absolute bottom-0 right-0 w-2/3 h-1/2 rounded-full bg-zinc-600/10 blur-3xl" />
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <span className="font-serif italic text-[#D4AF37]/25 text-6xl leading-none text-center line-clamp-3">
        {story.film?.title || story.source}
      </span>
    </div>
  </div>
);

export const StoryImage: React.FC<{ story: NewsStory; className?: string; eager?: boolean }> = ({
  story,
  className = '',
  eager,
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [story.image?.url]);
  if (!story.image || failed) return <PosterFallback story={story} className={className} />;
  return (
    <img
      key={story.image.url} // fresh element per image: never show the last story's photo while this one loads
      src={story.image.url}
      alt={story.film ? `${story.film.title} — ${story.image.credit}` : story.title}
      referrerPolicy="no-referrer"
      loading={eager ? 'eager' : 'lazy'}
      draggable={false}
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export const StoryCard = forwardRef<StoryCardHandle, StoryCardProps>(
  ({ story, take, depth, enterFrom = 0, onDecide, onOpen }, ref) => {
    const reduceMotion = useReducedMotion();
    const x = useMotionValue(enterFrom ? enterFrom * 520 : 0);
    const rotate = useTransform(x, [-360, 0, 360], [-10, 0, 10]);
    const printOpacity = useTransform(x, [24, SWIPE_POWER], [0, 1]);
    const cutOpacity = useTransform(x, [-SWIPE_POWER, -24], [1, 0]);
    const flinging = useRef(false);
    const dragged = useRef(0);

    useEffect(() => {
      if (enterFrom) animate(x, 0, { type: 'spring', stiffness: 260, damping: 28 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fling = useCallback(
      (dir: 1 | -1) => {
        if (flinging.current) return;
        flinging.current = true;
        const distance = (typeof window !== 'undefined' ? window.innerWidth : 900) * 0.8 + 320;
        animate(x, dir * distance, { duration: reduceMotion ? 0.12 : 0.3, ease: [0.32, 0.72, 0, 1] }).then(() =>
          onDecide(dir)
        );
      },
      [x, onDecide, reduceMotion]
    );

    useImperativeHandle(ref, () => ({ fling }), [fling]);

    const isTop = depth === 0;
    const meta = CATEGORY_META[story.category];
    const when = timeAgo(story.publishedAt);

    return (
      <motion.article
        aria-hidden={!isTop}
        aria-label={isTop ? `${meta.label} from ${story.source}: ${story.title}` : undefined}
        drag={isTop ? 'x' : false}
        dragMomentum={false}
        onPointerDown={() => {
          dragged.current = 0;
        }}
        onDrag={(_, info) => {
          dragged.current = Math.max(dragged.current, Math.abs(info.offset.x));
        }}
        onDragEnd={(_, info) => {
          const power = info.offset.x + info.velocity.x * 0.2;
          if (power > SWIPE_POWER) fling(1);
          else if (power < -SWIPE_POWER) fling(-1);
          else animate(x, 0, { type: 'spring', stiffness: 380, damping: 30 });
        }}
        onClick={() => {
          if (isTop && dragged.current < 6) onOpen();
        }}
        style={{ x: isTop ? x : 0, rotate: isTop ? rotate : 0, zIndex: 10 - depth }}
        initial={false}
        animate={{ scale: 1 - depth * 0.045, y: depth * 16, opacity: depth > 2 ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`absolute inset-0 rounded-[28px] overflow-hidden bg-[#0a0a0a] border border-zinc-800/80 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.95)] select-none ${
          isTop ? 'cursor-grab active:cursor-grabbing touch-pan-y' : 'pointer-events-none'
        }`}
      >
        {/* Art: the top ~62% of the card, fading into the headline block */}
        <div className="absolute inset-x-0 top-0 h-[62%]">
          <StoryImage story={story} eager={depth < 2} />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,5,5,0.6)_0%,rgba(5,5,5,0)_20%,rgba(5,5,5,0)_30%,rgba(10,10,10,0.72)_44%,rgba(10,10,10,0.94)_56%,#0a0a0a_64%)]"
        />
        <div aria-hidden className="film-grain absolute inset-0" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />

        {/* Cards waiting in the stack sit in shadow (opaque, so they never bleed through) */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: depth === 0 ? 0 : Math.min(0.75, 0.35 + depth * 0.2) }}
          className="absolute inset-0 z-20 bg-black pointer-events-none"
        />

        {/* Top rail */}
        <div className="absolute top-4 inset-x-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur border border-[#D4AF37]/40 text-[#D4AF37] text-[9px] font-mono uppercase tracking-[0.22em]">
              {meta.label}
            </span>
            {isFresh(story.publishedAt) && (
              <span className="px-2 py-1 rounded-full bg-emerald-500/15 backdrop-blur border border-emerald-400/40 text-emerald-300 text-[9px] font-mono uppercase tracking-[0.2em] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Just in
              </span>
            )}
            {story.coverage > 1 && (
              <span className="px-2 py-1 rounded-full bg-black/70 backdrop-blur border border-zinc-700 text-zinc-200 text-[9px] font-mono uppercase tracking-[0.2em] flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 text-[#D4AF37]" /> {story.coverage} outlets
              </span>
            )}
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-zinc-300 text-[9px] font-mono uppercase tracking-[0.18em]">
            {story.source}
            {when && <span className="text-zinc-500"> · {when}</span>}
          </span>
        </div>

        {story.trailer && (
          <div className="absolute right-4 top-[calc(62%-3.25rem)] flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-black/75 backdrop-blur border border-zinc-700 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-100">
            <span className="w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center">
              <Play className="w-2.5 h-2.5 fill-black text-black ml-px" />
            </span>
            Trailer
          </div>
        )}

        {/* Swipe stamps */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: printOpacity }}
              className="absolute top-20 left-6 -rotate-12 px-3 py-1 border-[3px] border-[#D4AF37] rounded-md text-[#D4AF37] font-mono font-bold text-2xl tracking-[0.2em] bg-black/40 backdrop-blur-sm"
            >
              PRINT IT
            </motion.div>
            <motion.div
              style={{ opacity: cutOpacity }}
              className="absolute top-20 right-6 rotate-12 px-3 py-1 border-[3px] border-rose-400 rounded-md text-rose-300 font-mono font-bold text-2xl tracking-[0.2em] bg-black/40 backdrop-blur-sm"
            >
              CUT
            </motion.div>
          </>
        )}

        {/* Headline block */}
        <div className="absolute inset-x-0 bottom-0 p-5 pb-4 space-y-2.5">
          {/* Shadow on a wrapper: line-clamp clips a text-shadow into a visible box. */}
          <div className="[filter:drop-shadow(0_2px_14px_rgba(0,0,0,0.85))]">
            <h2 className="font-serif text-[1.6rem] sm:text-[1.8rem] [@media(max-height:720px)]:text-[1.4rem] leading-[1.06] text-zinc-50 line-clamp-4 [@media(max-height:720px)]:line-clamp-3 [text-wrap:balance]">
              {story.title}
            </h2>
          </div>
          {take ? (
            <p className="text-[13px] leading-snug text-amber-100/90 font-serif italic line-clamp-3 [@media(max-height:720px)]:line-clamp-2">
              <Flame className="inline w-3.5 h-3.5 -mt-0.5 mr-1 text-[#D4AF37] not-italic" />
              {take.take}
            </p>
          ) : (
            story.summary && (
              <p className="text-[12.5px] leading-relaxed text-zinc-400 line-clamp-3 [@media(max-height:720px)]:line-clamp-2">{story.summary}</p>
            )
          )}
          <div className="flex items-center justify-between pt-1 text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-600">
            <span className="truncate pr-3">{story.image ? `Image · ${story.image.credit}` : 'No art on the wire'}</span>
            <span className="shrink-0 text-zinc-500">Tap for the take</span>
          </div>
        </div>
      </motion.article>
    );
  }
);
StoryCard.displayName = 'StoryCard';
