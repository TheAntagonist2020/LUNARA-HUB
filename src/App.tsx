import React, { useState, useEffect } from 'react';
import { SocialPost, FilmJournalEntry, PlatformMetric, LiveActivity, PostStatus } from './types';
import { INITIAL_FILM_JOURNAL, INITIAL_SOCIAL_POSTS, INITIAL_PLATFORM_METRICS, INITIAL_LIVE_ACTIVITIES } from './data/mockInitialData';
import { Header } from './components/Header';
import { CommandCenter } from './components/CommandCenter';
import { SocialPlanner } from './components/SocialPlanner';
import { FilmJournal } from './components/FilmJournal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AICopilotStudio } from './components/AICopilotStudio';
import { NewPostModal } from './components/NewPostModal';
import { NewJournalModal } from './components/NewJournalModal';
import { InstanceConnectionsModal } from './components/InstanceConnectionsModal';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'command' | 'planner' | 'journal' | 'analytics' | 'copilot'>('command');

  // Core Data State with Local Storage fallback
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const saved = localStorage.getItem('lunara_posts');
    return saved ? JSON.parse(saved) : INITIAL_SOCIAL_POSTS;
  });

  const [journalEntries, setJournalEntries] = useState<FilmJournalEntry[]>(() => {
    const saved = localStorage.getItem('lunara_journal');
    return saved ? JSON.parse(saved) : INITIAL_FILM_JOURNAL;
  });

  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetric[]>(INITIAL_PLATFORM_METRICS);

  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>(() => {
    const saved = localStorage.getItem('lunara_activities');
    return saved ? JSON.parse(saved) : INITIAL_LIVE_ACTIVITIES;
  });

  // Ticker Simulation Toggle
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Modals & Selected States
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState<SocialPost | null>(null);

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalToEdit, setJournalToEdit] = useState<FilmJournalEntry | null>(null);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);

  const [selectedJournalForAI, setSelectedJournalForAI] = useState<FilmJournalEntry | null>(null);

  // Sync to Local Storage
  useEffect(() => {
    localStorage.setItem('lunara_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('lunara_journal', JSON.stringify(journalEntries));
  }, [journalEntries]);

  useEffect(() => {
    localStorage.setItem('lunara_activities', JSON.stringify(liveActivities));
  }, [liveActivities]);

  // Real-Time Engagement Ticker Simulation
  useEffect(() => {
    if (!isSimulating) return;

    const mockUsers = ['@cinephile_sam', '@film_critic_kat', '@a24_devotee', '@lens_and_frame', '@movie_nerd_99', '@screenplay_pro'];
    const mockFilms = ['Dune: Part Two', 'Challengers', 'The Zone of Interest', 'Anatomy of a Fall', 'Mickey 17'];
    const mockPlatforms: ('twitter' | 'instagram' | 'letterboxd' | 'tiktok')[] = ['twitter', 'instagram', 'letterboxd', 'tiktok'];
    const mockActions: ('liked' | 'retweeted' | 'logged' | 'commented' | 'clicked_link' | 'shared')[] = [
      'liked', 'retweeted', 'logged', 'commented', 'clicked_link', 'shared'
    ];

    const interval = setInterval(() => {
      const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
      const film = mockFilms[Math.floor(Math.random() * mockFilms.length)];
      const platform = mockPlatforms[Math.floor(Math.random() * mockPlatforms.length)];
      const action = mockActions[Math.floor(Math.random() * mockActions.length)];

      const newActivity: LiveActivity = {
        id: `act-${Date.now()}`,
        timestamp: 'Just now',
        platform,
        username: user,
        avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 500000)}?q=80&w=150&auto=format&fit=crop`,
        action,
        filmTitle: film,
        postSnippet: `${action === 'clicked_link' ? 'Clicked LunaraFilm.com review article' : `${action} LUNARA ${film} coverage`}`,
        engagementDelta: Math.floor(Math.random() * 25) + 1,
      };

      setLiveActivities((prev) => [newActivity, ...prev.slice(0, 19)]);
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Slightly boost metrics
      setPosts((prev) =>
        prev.map((p) => {
          if (p.filmTitle === film || Math.random() > 0.7) {
            return {
              ...p,
              engagementStats: {
                ...p.engagementStats,
                likes: p.engagementStats.likes + (action === 'liked' ? 1 : 0),
                shares: p.engagementStats.shares + (action === 'retweeted' ? 1 : 0),
                clicks: p.engagementStats.clicks + (action === 'clicked_link' ? 1 : 0),
                reach: p.engagementStats.reach + 12,
              },
            };
          }
          return p;
        })
      );
    }, 4500);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Handlers for Social Posts
  const handleSavePost = (postData: Partial<SocialPost>) => {
    if (postData.id) {
      // Edit
      setPosts((prev) =>
        prev.map((p) => (p.id === postData.id ? { ...p, ...postData } : p))
      );
    } else {
      // New
      const newPost: SocialPost = {
        id: `post-${Date.now()}`,
        filmTitle: postData.filmTitle || 'General Film Feature',
        platform: postData.platform || 'twitter',
        content: postData.content || '',
        scheduledTime: postData.scheduledTime || new Date().toISOString(),
        status: postData.status || 'scheduled',
        mediaUrl: postData.mediaUrl,
        articleUrl: postData.articleUrl,
        engagementStats: { likes: 0, shares: 0, comments: 0, clicks: 0, reach: 0 },
        hashtags: postData.hashtags || ['#LunaraFilm'],
        aiGenerated: postData.aiGenerated || false,
      };
      setPosts((prev) => [newPost, ...prev]);
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleUpdateStatus = (postId: string, status: PostStatus) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status } : p))
    );
  };

  const handlePublishPostNow = (postId: string) => {
    handleUpdateStatus(postId, 'published');
  };

  // Handlers for Film Journal Entries
  const handleSaveJournal = (entryData: Partial<FilmJournalEntry>) => {
    if (entryData.id) {
      // Edit
      setJournalEntries((prev) =>
        prev.map((j) => (j.id === entryData.id ? { ...j, ...entryData } : j))
      );
    } else {
      // New
      const newEntry: FilmJournalEntry = {
        id: `film-${Date.now()}`,
        title: entryData.title || 'Untitled Movie',
        director: entryData.director || 'Unknown',
        year: entryData.year || new Date().getFullYear(),
        posterUrl: entryData.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
        rating: entryData.rating || 4.5,
        reviewText: entryData.reviewText || '',
        favoriteQuote: entryData.favoriteQuote,
        tags: entryData.tags || ['Film'],
        status: 'logged',
        dateWatched: new Date().toISOString().split('T')[0],
        articleUrl: entryData.articleUrl,
      };
      setJournalEntries((prev) => [newEntry, ...prev]);
    }
  };

  const handleDeleteJournal = (id: string) => {
    setJournalEntries((prev) => prev.filter((j) => j.id !== id));
  };

  // Trigger Gemini AI Copilot from Journal Entry
  const handleSelectJournalForAI = (entry: FilmJournalEntry) => {
    setSelectedJournalForAI(entry);
    setActiveTab('copilot');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Top LUNARA FILM Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewPost={() => {
          setPostToEdit(null);
          setIsPostModalOpen(true);
        }}
        onOpenNewJournal={() => {
          setJournalToEdit(null);
          setIsJournalModalOpen(true);
        }}
        onOpenConnectionsModal={() => setIsConnectionsModalOpen(true)}
        isSimulating={isSimulating}
        setIsSimulating={setIsSimulating}
        lastSyncTime={lastSyncTime}
      />

      {/* Main View Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        
        {activeTab === 'command' && (
          <CommandCenter
            posts={posts}
            journalEntries={journalEntries}
            platformMetrics={platformMetrics}
            liveActivities={liveActivities}
            onOpenNewPost={() => {
              setPostToEdit(null);
              setIsPostModalOpen(true);
            }}
            onOpenNewJournal={() => {
              setJournalToEdit(null);
              setIsJournalModalOpen(true);
            }}
            onSelectJournalForAI={handleSelectJournalForAI}
            onPublishPostNow={handlePublishPostNow}
            onGoToPlanner={() => setActiveTab('planner')}
            onGoToAnalytics={() => setActiveTab('analytics')}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
          />
        )}

        {activeTab === 'planner' && (
          <SocialPlanner
            posts={posts}
            onOpenNewPost={() => {
              setPostToEdit(null);
              setIsPostModalOpen(true);
            }}
            onEditPost={(post) => {
              setPostToEdit(post);
              setIsPostModalOpen(true);
            }}
            onDeletePost={handleDeletePost}
            onUpdateStatus={handleUpdateStatus}
            onPolishWithAI={(post) => {
              setActiveTab('copilot');
            }}
          />
        )}

        {activeTab === 'journal' && (
          <FilmJournal
            entries={journalEntries}
            onOpenNewJournal={() => {
              setJournalToEdit(null);
              setIsJournalModalOpen(true);
            }}
            onEditJournal={(entry) => {
              setJournalToEdit(entry);
              setIsJournalModalOpen(true);
            }}
            onDeleteJournal={handleDeleteJournal}
            onSelectJournalForAI={handleSelectJournalForAI}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            posts={posts}
            platformMetrics={platformMetrics}
          />
        )}

        {activeTab === 'copilot' && (
          <AICopilotStudio
            journalEntries={journalEntries}
            selectedJournalEntry={selectedJournalForAI}
            onAddPostToQueue={(postData) => {
              handleSavePost(postData);
            }}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600 font-mono">
        <p>LUNARA FILM © 2026 • Cinema Journal & Real-Time Social Media Engagement Hub</p>
      </footer>

      {/* Modals */}
      {isPostModalOpen && (
        <NewPostModal
          postToEdit={postToEdit}
          onSave={handleSavePost}
          onClose={() => setIsPostModalOpen(false)}
        />
      )}

      {isJournalModalOpen && (
        <NewJournalModal
          entryToEdit={journalToEdit}
          onSave={handleSaveJournal}
          onClose={() => setIsJournalModalOpen(false)}
        />
      )}

      {isConnectionsModalOpen && (
        <InstanceConnectionsModal
          isOpen={isConnectionsModalOpen}
          onClose={() => setIsConnectionsModalOpen(false)}
          journalEntries={journalEntries}
        />
      )}

    </div>
  );
}
