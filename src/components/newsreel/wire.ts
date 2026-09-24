import { HotTake, NewsCategory, NewsStory } from '../../types';

export const CATEGORY_META: Record<NewsCategory, { label: string; chip: string }> = {
  trailers: { label: 'Trailer', chip: 'Trailers' },
  casting: { label: 'Casting', chip: 'Casting' },
  boxoffice: { label: 'Box Office', chip: 'Box Office' },
  awards: { label: 'Awards & Fests', chip: 'Awards & Fests' },
  streaming: { label: 'Streaming', chip: 'Streaming' },
  reviews: { label: 'Review', chip: 'Reviews' },
  news: { label: 'News', chip: 'News' },
};

export const CATEGORY_ORDER: NewsCategory[] = ['trailers', 'casting', 'boxoffice', 'awards', 'streaming', 'reviews', 'news'];

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export const isFresh = (iso: string | null) => Boolean(iso && Date.now() - Date.parse(iso) < 60 * 60 * 1000);

// The deck's title follows the clock like a theater marquee.
export function showtime(date = new Date()): { title: string; kicker: string } {
  const h = date.getHours();
  if (h < 5) return { title: 'The Midnight Show', kicker: 'For the insomniacs' };
  if (h < 12) return { title: 'The Morning Reel', kicker: 'Coffee, then carnage' };
  if (h < 17) return { title: 'The Matinee', kicker: 'Cheap seats, hot takes' };
  if (h < 21) return { title: 'The Evening Show', kicker: 'Prime time for opinions' };
  return { title: 'The Late Show', kicker: 'Last call on the wire' };
}

// X counts every link as 23 characters, whatever its real length.
export const xLength = (text: string) => text.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length;

export function composePost(story: NewsStory, take: HotTake | null): string {
  const tags = take?.hashtags?.length ? `\n\n${take.hashtags.join(' ')}` : '';
  const lead = take?.post || story.title;
  return `${lead}${tags}\n\nvia ${story.source}: ${story.url}`;
}

// localStorage is a per-viewer convenience only — every read and write is
// guarded so private windows and blocked storage just fall back to defaults.
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — the session still works, it just won't remember
  }
}
