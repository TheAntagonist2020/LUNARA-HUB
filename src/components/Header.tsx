import React from 'react';
import { Radio, Sparkles, Plus, BarChart3, Calendar, BookOpen, RefreshCw, Globe, Clapperboard } from 'lucide-react';
import { TabId } from '../types';

const TABS: Array<{ id: TabId; label: string; short: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'newsreel', label: 'Newsreel', short: 'Reel', Icon: Clapperboard },
  { id: 'command', label: 'Dashboard', short: 'Desk', Icon: Radio },
  { id: 'planner', label: 'Planner', short: 'Plan', Icon: Calendar },
  { id: 'journal', label: 'Journal', short: 'Journal', Icon: BookOpen },
  { id: 'analytics', label: 'Analytics', short: 'Stats', Icon: BarChart3 },
  { id: 'copilot', label: 'Copilot', short: 'Copilot', Icon: Sparkles },
];

interface HeaderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onOpenNewPost: () => void;
  onOpenNewJournal: () => void;
  onOpenConnectionsModal: () => void;
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  lastSyncTime: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewPost,
  onOpenNewJournal,
  onOpenConnectionsModal,
  isSimulating,
  setIsSimulating,
  lastSyncTime,
}) => {
  return (
    <>
      <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3 transition-all">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-3 xl:gap-4">
        
          {/* LUNARA Brand Logo & Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-zinc-700 bg-zinc-900/90 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-xs font-serif italic text-[#D4AF37]">LF</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="font-serif text-xl sm:text-2xl italic tracking-[0.12em] sm:tracking-widest text-[#D4AF37] font-semibold whitespace-nowrap">
                    LUNARA FILM
                  </h1>
                  <span className="hidden sm:flex xl:hidden whitespace-nowrap text-[9px] uppercase tracking-[0.2em] font-mono px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                    SYSTEM ACTIVE
                  </span>
                </div>
                <p className="hidden sm:flex text-[11px] text-zinc-500 items-center gap-2 mt-0.5 whitespace-nowrap">
                  <span className="uppercase tracking-widest font-mono text-[10px]">Cinema Control Hub</span>
                  <span className="text-zinc-700">•</span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                    <RefreshCw className="w-3 h-3 text-emerald-400" /> Synced {lastSyncTime}
                  </span>
                </p>
              </div>
            </div>

            {/* Compact Action Controls (Mobile) */}
            <div className="xl:hidden flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsSimulating(!isSimulating)}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono border transition-all ${
                  isSimulating
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
                }`}
              >
                <Radio className={`w-3 h-3 ${isSimulating ? 'animate-ping text-emerald-400' : ''}`} />
                {isSimulating ? 'LIVE' : 'PAUSED'}
              </button>
              <button
                onClick={onOpenConnectionsModal}
                title="Connections & WP sync"
                className="p-2 rounded-lg bg-[#0a0a0a] border border-zinc-800 text-zinc-300 active:bg-zinc-900 transition-all"
              >
                <Globe className="w-4 h-4 text-[#D4AF37]" />
              </button>
              <button
                onClick={onOpenNewJournal}
                title="New film log"
                className="p-2 rounded-lg bg-[#0a0a0a] border border-zinc-800 text-zinc-300 active:bg-zinc-900 transition-all"
              >
                <BookOpen className="w-4 h-4 text-[#D4AF37]" />
              </button>
              <button
                onClick={onOpenNewPost}
                title="Create entry"
                className="p-2 rounded-lg border border-[#D4AF37] text-[#D4AF37] active:bg-[#D4AF37] active:text-black transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs (desktop — phones get the bottom tab bar) */}
          <nav className="hidden md:flex items-center gap-1.5 self-start xl:self-auto max-w-full bg-[#0a0a0a] p-1.5 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-none">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs uppercase tracking-[0.12em] font-medium transition-all whitespace-nowrap ${
                  activeTab === id
                    ? 'text-white border-b-2 border-[#D4AF37] bg-zinc-900/60 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
                }`}
              >
                {/* In the one-row desktop header six tabs need the room, so labels only. */}
                <Icon className="w-3.5 h-3.5 text-[#D4AF37] xl:hidden" />
                {label}
              </button>
            ))}
          </nav>

          {/* Action Controls */}
          <div className="hidden xl:flex items-center gap-2 whitespace-nowrap shrink-0">
            <button
              onClick={onOpenConnectionsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]/50 text-zinc-300 text-xs font-mono uppercase tracking-wider transition-all"
              title="WP Sync — connections & site sync"
              aria-label="WP Sync — connections & site sync"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
            </button>

            <button
              onClick={onOpenNewJournal}
              title="New film log"
              aria-label="New film log"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-medium uppercase tracking-wider transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            </button>

            <button
              onClick={onOpenNewPost}
              title="Create entry"
              className="flex items-center gap-1.5 px-4 py-1.5 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Create
            </button>
          </div>

        </div>
      </header>

      {/* Phone tab bar — thumb-reachable, clears the home indicator. Lives
          outside <header>: its backdrop-blur would trap position:fixed. */}
      <nav
        aria-label="Sections"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#050505]/95 backdrop-blur-md border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
        <div className="grid grid-cols-6">
          {TABS.map(({ id, short, Icon }) => {
            const on = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={on ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[9px] uppercase tracking-[0.12em] transition-colors ${
                  on ? 'text-[#D4AF37]' : 'text-zinc-500 active:text-zinc-200'
                }`}
              >
                {on && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.8)]" />}
                <Icon className="w-5 h-5" />
                {short}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
