import { FilmJournalEntry, SocialPost, PlatformMetric, LiveActivity } from '../types';

export const INITIAL_FILM_JOURNAL: FilmJournalEntry[] = [
  {
    id: 'film-1',
    title: 'Dune: Part Two',
    director: 'Denis Villeneuve',
    year: 2024,
    posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
    rating: 5,
    reviewText: 'An uncompromising masterpiece of modern sci-fi cinema. Villeneuve achieves a monumental scale where sound design, Hans Zimmer’s brassy score, and Greig Fraser’s golden cinematography merge into pure sensory myth-making.',
    favoriteQuote: 'May thy knife chip and shatter.',
    tags: ['Sci-Fi', 'Epic', 'Must-Watch', 'IMAX'],
    status: 'converted_to_social',
    dateWatched: '2024-03-01',
    articleUrl: 'https://lunarafilm.com/reviews/dune-part-two-masterpiece',
    letterboxdUrl: 'https://letterboxd.com/lunarafilm/film/dune-part-two/',
    section: 'Signal',
    featureOnHomepage: true,
    featurePriority: 0,
    signalOverrides: {
      signalContextKicker: 'SIGNAL • MUST-WATCH',
      articleDetailsKicker: 'CRITICAL AUDIT',
      journalCtaLabel: 'Read Full LUNARA Essay',
      journalCtaUrl: 'https://lunarafilm.com/reviews/dune-part-two-masterpiece',
      hideHeroMedia: false,
    },
    trailerInfo: {
      trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
      trailerPlacement: 'After first paragraph',
      trailerLabel: 'Official Trailer 2',
      sourceCredit: 'Warner Bros. Pictures / Legendary',
      editorialNote: 'Greig Fraser’s 70mm IMAX framing redefined sci-fi scale.'
    },
    provenance: {
      configVersion: '1.0.19',
      promptVersion: 'journal-1.0.19',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      generatedAtGMT: '2026-07-28 05:31:39'
    }
  },
  {
    id: 'film-2',
    title: 'The Zone of Interest',
    director: 'Jonathan Glazer',
    year: 2023,
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop',
    rating: 5,
    reviewText: 'Glazer creates a chillingly formalist study of human apathy. The auditory landscape is the real protagonist here—a devastating wall of sound contrast that haunts long after the credits fade.',
    favoriteQuote: 'We want to make sure the garden stays beautiful.',
    tags: ['Historical', 'Sound Design', 'Auteur', 'Oscar Winner'],
    status: 'converted_to_social',
    dateWatched: '2024-02-15',
    articleUrl: 'https://lunarafilm.com/reviews/zone-of-interest-audit',
    section: 'Awards Season',
    featureOnHomepage: true,
    featurePriority: 1,
    signalOverrides: {
      signalContextKicker: 'AWARDS SEASON AUDIT',
      articleDetailsKicker: 'SOUNDSCAPE ANALYSIS',
      journalCtaLabel: 'Explore Sound Analysis',
      journalCtaUrl: 'https://lunarafilm.com/reviews/zone-of-interest-audit',
      hideHeroMedia: false,
    },
    trailerInfo: {
      trailerUrl: 'https://www.youtube.com/watch?v=r-vfg3KkV5E',
      trailerPlacement: 'Hero',
      trailerLabel: 'Official Teaser',
      sourceCredit: 'A24 Film Studios',
      editorialNote: 'Winner of Academy Award for Best Sound and Best International Feature.'
    },
    provenance: {
      configVersion: '1.0.19',
      promptVersion: 'journal-1.0.19',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      generatedAtGMT: '2026-07-28 06:12:00'
    }
  },
  {
    id: 'film-3',
    title: 'Challengers',
    director: 'Luca Guadagnino',
    year: 2024,
    posterUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266010b?q=80&w=800&auto=format&fit=crop',
    rating: 4.5,
    reviewText: 'High-octane kinetic romance disguised as a tennis match. Trent Reznor & Atticus Ross deliver a pulsating techno soundtrack that turns every serve into a psychological battleground.',
    favoriteQuote: 'I am taking such good care of my little boys.',
    tags: ['Romance', 'Sport', 'Techno Score', 'Zendaya'],
    status: 'converted_to_social',
    dateWatched: '2024-04-26',
    articleUrl: 'https://lunarafilm.com/reviews/challengers-guadagnino-breakdown',
    section: 'Casting & Production',
    featureOnHomepage: false,
    signalOverrides: {
      signalContextKicker: 'DIRECTOR ESSAY',
      articleDetailsKicker: 'VISUAL KINETICISM',
      journalCtaLabel: 'Read Guadagnino Essay',
      journalCtaUrl: 'https://lunarafilm.com/reviews/challengers-guadagnino-breakdown',
      hideHeroMedia: false,
    },
    trailerInfo: {
      trailerUrl: 'https://www.youtube.com/watch?v=Vob8T46sJkI',
      trailerPlacement: 'After first paragraph',
      trailerLabel: 'Official Trailer',
      sourceCredit: 'MGM / Amazon Studios',
      editorialNote: 'Pulsating synth score by Trent Reznor & Atticus Ross.'
    },
    provenance: {
      configVersion: '1.0.19',
      promptVersion: 'journal-1.0.19',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      generatedAtGMT: '2026-07-28 07:05:22'
    }
  },
  {
    id: 'film-4',
    title: 'Anatomy of a Fall',
    director: 'Justine Triet',
    year: 2023,
    posterUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=800&auto=format&fit=crop',
    rating: 4.5,
    reviewText: 'Sandra Hüller gives a career-defining performance in a legal drama that is fundamentally about the elusive nature of truth in intimate relationships.',
    favoriteQuote: 'Sometimes a couple is a kind of chaos.',
    tags: ['Courtroom Drama', 'Palme dOr', 'French Cinema'],
    status: 'logged',
    dateWatched: '2024-01-20',
    articleUrl: 'https://lunarafilm.com/reviews/anatomy-of-a-fall-truth',
    section: 'News',
    featureOnHomepage: false,
    provenance: {
      configVersion: '1.0.19',
      promptVersion: 'journal-1.0.19',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      generatedAtGMT: '2026-07-28 07:44:10'
    }
  },
  {
    id: 'film-5',
    title: 'Mickey 17',
    director: 'Bong Joon-ho',
    year: 2025,
    posterUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
    rating: 4.0,
    reviewText: 'Bong Joon-ho returns with a sharp satirical sci-fi piece. Robert Pattinson displays astonishing physical comedy and existential dread across multiple clones.',
    favoriteQuote: 'Dying is a living.',
    tags: ['Sci-Fi', 'Satire', 'Bong Joon Ho', 'Upcoming'],
    status: 'draft',
    dateWatched: '2025-01-10',
    articleUrl: 'https://lunarafilm.com/previews/mickey-17-bong-joon-ho',
    section: 'Signal',
    featureOnHomepage: true,
    featurePriority: 2,
    provenance: {
      configVersion: '1.0.19',
      promptVersion: 'journal-1.0.19',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      generatedAtGMT: '2026-07-28 08:20:00'
    }
  }
];

export const INITIAL_SOCIAL_POSTS: SocialPost[] = [
  {
    id: 'post-101',
    filmId: 'film-1',
    filmTitle: 'Dune: Part Two',
    platform: 'twitter',
    content: 'Denis Villeneuve didn’t just adapt Dune—he built a temple to immersive cinema. Greig Fraser’s framing and Hans Zimmer’s terrifying soundscape make this the definitive theatrical spectacle of the decade. \n\nFull LUNARA FILM review breakdown: https://lunarafilm.com/reviews/dune-part-two-masterpiece',
    scheduledTime: '2026-07-28T18:00:00Z',
    status: 'published',
    mediaUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
    engagementStats: {
      likes: 12450,
      shares: 3120,
      comments: 840,
      clicks: 4890,
      reach: 185000
    },
    hashtags: ['#DunePartTwo', '#LunaraFilm', '#Cinema', '#Villeneuve', '#FilmTwitter'],
    aiGenerated: true,
    articleUrl: 'https://lunarafilm.com/reviews/dune-part-two-masterpiece'
  },
  {
    id: 'post-102',
    filmId: 'film-3',
    filmTitle: 'Challengers',
    platform: 'instagram',
    content: 'The court is a battlefield and love is the point scored. 🎾\n\nGuadagnino’s CHALLENGERS is fueled by Reznor & Ross’s relentless techno rhythm and three electrifying performances.\n\nHave you logged this on Letterboxd yet? Tap link in bio for our deep-dive essay on Guadagnino’s visual kineticism.',
    scheduledTime: '2026-07-28T21:30:00Z',
    status: 'scheduled',
    mediaUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266010b?q=80&w=800&auto=format&fit=crop',
    engagementStats: {
      likes: 8900,
      shares: 1200,
      comments: 410,
      clicks: 2950,
      reach: 94000
    },
    hashtags: ['#Challengers', '#Zendaya', '#FilmReview', '#LunaraFilm', '#Cinephile'],
    articleUrl: 'https://lunarafilm.com/reviews/challengers-guadagnino-breakdown'
  },
  {
    id: 'post-103',
    filmId: 'film-2',
    filmTitle: 'The Zone of Interest',
    platform: 'letterboxd',
    content: '★★★★★ - "A monumental achievement in audio storytelling. The horror is never pictured on screen; it lives entirely inside Tarn Willers and Johnnie Burn’s unbearable sound mix. Glazer forces us to confront our own capacity for compartmentalization."',
    scheduledTime: '2026-07-29T10:00:00Z',
    status: 'queued',
    mediaUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop',
    engagementStats: {
      likes: 4200,
      shares: 980,
      comments: 310,
      clicks: 1800,
      reach: 48000
    },
    hashtags: ['#Letterboxd', '#TheZoneOfInterest', '#Glazer', '#LunaraFilm']
  },
  {
    id: 'post-104',
    filmId: 'film-5',
    filmTitle: 'Mickey 17',
    platform: 'tiktok',
    content: 'POV: You die for a living and Robert Pattinson is your boss 💀🎬 Bong Joon-ho’s Mickey 17 is coming and here are 3 details you missed in the first look.',
    scheduledTime: '2026-07-29T15:00:00Z',
    status: 'scheduled',
    mediaUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
    engagementStats: {
      likes: 18400,
      shares: 4200,
      comments: 920,
      clicks: 3400,
      reach: 220000
    },
    hashtags: ['#Mickey17', '#BongJoonHo', '#MovieTok', '#FilmTok', '#LunaraFilm']
  },
  {
    id: 'post-105',
    filmTitle: 'Top 10 Cinematography Feats of the 2020s',
    platform: 'twitter',
    content: 'THREAD: The 10 most visually transcendent camera moves in 2020s cinema so far, from Greig Fraser in Dune to Hoyte van Hoytema in Oppenheimer. 🧵👇',
    scheduledTime: '2026-07-30T12:00:00Z',
    status: 'draft',
    engagementStats: {
      likes: 0,
      shares: 0,
      comments: 0,
      clicks: 0,
      reach: 0
    },
    hashtags: ['#Cinematography', '#FilmTwitter', '#LunaraFilm', '#MovieList']
  }
];

export const INITIAL_PLATFORM_METRICS: PlatformMetric[] = [
  {
    platform: 'twitter',
    name: 'X / Twitter',
    handle: '@LunaraFilm',
    followers: 48920,
    followersGrowth24h: 312,
    reach24h: 245000,
    engagementRate: 7.8,
    activeQueueCount: 3,
    color: '#38bdf8'
  },
  {
    platform: 'letterboxd',
    name: 'Letterboxd HQ',
    handle: 'lunarafilm',
    followers: 32400,
    followersGrowth24h: 189,
    reach24h: 89000,
    engagementRate: 11.2,
    activeQueueCount: 2,
    color: '#00e054'
  },
  {
    platform: 'instagram',
    name: 'Instagram',
    handle: '@lunarafilmjournal',
    followers: 71800,
    followersGrowth24h: 540,
    reach24h: 310000,
    engagementRate: 6.4,
    activeQueueCount: 4,
    color: '#e1306c'
  },
  {
    platform: 'tiktok',
    name: 'TikTok FilmTok',
    handle: '@lunarafilmofficial',
    followers: 112500,
    followersGrowth24h: 1250,
    reach24h: 580000,
    engagementRate: 9.1,
    activeQueueCount: 2,
    color: '#25f4ee'
  },
  {
    platform: 'threads',
    name: 'Threads',
    handle: '@lunarafilmjournal',
    followers: 19400,
    followersGrowth24h: 95,
    reach24h: 42000,
    engagementRate: 5.2,
    activeQueueCount: 1,
    color: '#a855f7'
  }
];

export const INITIAL_LIVE_ACTIVITIES: LiveActivity[] = [
  {
    id: 'act-1',
    timestamp: 'Just now',
    platform: 'letterboxd',
    username: '@cinephile_mara',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
    action: 'logged',
    filmTitle: 'Dune: Part Two',
    postSnippet: 'Replied: "LUNARA FILM review hit the nail on the head regarding the sound design!"',
    engagementDelta: 1
  },
  {
    id: 'act-2',
    timestamp: '1m ago',
    platform: 'twitter',
    username: '@film_junkie_99',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
    action: 'retweeted',
    filmTitle: 'Dune: Part Two',
    postSnippet: 'Retweeted LUNARA FILM Dune breakdown to 14.2k followers',
    engagementDelta: 145
  },
  {
    id: 'act-3',
    timestamp: '3m ago',
    platform: 'instagram',
    username: '@lens_and_light',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop',
    action: 'clicked_link',
    filmTitle: 'Challengers',
    postSnippet: 'Clicked LUNARA Website link from Instagram Bio',
    engagementDelta: 1
  },
  {
    id: 'act-4',
    timestamp: '5m ago',
    platform: 'tiktok',
    username: '@movie_buff_leo',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop',
    action: 'shared',
    filmTitle: 'Mickey 17',
    postSnippet: 'Shared Mickey 17 preview reel on TikTok',
    engagementDelta: 32
  },
  {
    id: 'act-5',
    timestamp: '8m ago',
    platform: 'letterboxd',
    username: '@a24_obsessed',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop',
    action: 'liked',
    filmTitle: 'The Zone of Interest',
    postSnippet: 'Liked LUNARA 5-star review on Letterboxd',
    engagementDelta: 1
  }
];
