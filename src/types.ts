export type PlatformType = 'twitter' | 'instagram' | 'letterboxd' | 'tiktok' | 'youtube' | 'threads';

export type TabId = 'newsreel' | 'command' | 'planner' | 'journal' | 'analytics' | 'copilot';

// ── Newsreel (the movie news wire — shapes mirror GET /api/news/feed) ──────

export type NewsCategory = 'trailers' | 'casting' | 'boxoffice' | 'awards' | 'streaming' | 'reviews' | 'news';

export interface NewsStory {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceId: string;
  kind: 'news' | 'trailers';
  category: NewsCategory;
  publishedAt: string | null;
  summary: string;
  author?: string;
  // official = studio key art / official trailer still — the only art the hub
  // attaches to social posts. Outlet photos are display-only.
  image?: { url: string; credit: string; official: boolean };
  film?: {
    tmdbId: number;
    title: string;
    year?: string;
    releaseDate?: string;
    overview?: string;
    poster?: string;
    backdrop?: string;
    studio?: string;
    tmdbUrl: string;
  };
  trailer?: { youtubeId: string; url: string; name: string; credit: string };
  coverage: number; // outlets on the current wire covering the same film
}

export interface WireSourceStatus {
  id: string;
  label: string;
  kind: 'news' | 'trailers';
  ok: boolean;
  count: number;
  error?: string;
}

export type Spice = 'mild' | 'hot' | 'scorching';

export interface HotTake {
  summary: string;
  take: string;
  post: string;
  hashtags: string[];
  provider: 'claude' | 'gemini' | 'template';
  spice: Spice;
}

// A Workshop session on one story: the back-and-forth with Claude, plus the
// earlier versions of the take for undo.
export interface WorkshopThread {
  messages: Array<{ role: 'dalton' | 'claude'; text: string }>;
  versions: Array<{ take: string; post: string }>;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'queued';

export interface EngagementStats {
  likes: number;
  shares: number; // Retweets or Reposts
  comments: number;
  clicks: number; // Clicks to Lunara Film Website
  reach: number;
}

export interface SocialPost {
  id: string;
  filmId?: string;
  filmTitle?: string;
  platform: PlatformType;
  content: string;
  scheduledTime: string; // ISO string or format
  status: PostStatus;
  mediaUrl?: string;
  engagementStats: EngagementStats;
  hashtags: string[];
  aiGenerated?: boolean;
  articleUrl?: string;
  authorNote?: string;
}

export interface LunaraTrailerInfo {
  trailerUrl?: string;
  trailerPlacement?: 'After first paragraph' | 'Hero' | 'Footer';
  trailerLabel?: string;
  sourceCredit?: string;
  editorialNote?: string;
}

export interface LunaraSignalOverrides {
  hideHeroMedia?: boolean;
  signalNoteOverride?: string;
  journalCtaLabel?: string;
  journalCtaUrl?: string;
  articleDetailsKicker?: string;
  signalContextKicker?: string;
  filedUnderOverride?: string;
}

export interface LunaraProvenance {
  configVersion?: string;
  promptVersion?: string;
  provider?: string;
  model?: string;
  generatedAtGMT?: string;
}

export interface FilmJournalEntry {
  id: string;
  title: string;
  director: string;
  year: number;
  posterUrl: string;
  rating: number; // 0.5 to 5
  reviewText: string;
  favoriteQuote?: string;
  tags: string[];
  status: 'logged' | 'converted_to_social' | 'draft';
  dateWatched: string;
  articleUrl?: string;
  letterboxdUrl?: string;
  
  // Lunara Journal CMS Control Fields (from Lunara WP Control Plane)
  section?: 'Signal' | 'Awards Season' | 'Box Office' | 'Casting & Production' | 'News' | 'Physical Media' | 'Streaming';
  featureOnHomepage?: boolean;
  featurePriority?: number;
  signalOverrides?: LunaraSignalOverrides;
  trailerInfo?: LunaraTrailerInfo;
  provenance?: LunaraProvenance;
}

export interface PlatformMetric {
  platform: PlatformType;
  name: string;
  handle: string;
  followers: number;
  followersGrowth24h: number;
  reach24h: number;
  engagementRate: number; // e.g. 7.4%
  activeQueueCount: number;
  color: string;
}

export interface LiveActivity {
  id: string;
  timestamp: string; // e.g. "2m ago"
  platform: PlatformType;
  username: string;
  avatar: string;
  action: 'liked' | 'retweeted' | 'logged' | 'commented' | 'clicked_link' | 'shared';
  filmTitle: string;
  postSnippet: string;
  engagementDelta: number;
}
