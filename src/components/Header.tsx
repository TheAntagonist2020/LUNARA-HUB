import React from 'react';
import { Film, Radio, Sparkles, Plus, BarChart3, Calendar, BookOpen, Cpu, RefreshCw, Globe } from 'lucide-react';

interface HeaderProps {
  activeTab: 'command' | 'planner' | 'journal' | 'analytics' | 'copilot';
  setActiveTab: (tab: 'command' | 'planner' | 'journal' | 'analytics' | 'copilot') => void;
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
    <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* LUNARA Brand Logo & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-900/90 flex items-center justify-center shrink-0 shadow-inner">
              <span className="text-xs font-serif italic text-[#D4AF37]">LF</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl italic tracking-widest text-[#D4AF37] font-semibold">
                  LUNARA FILM
                </h1>
                <span className="text-[9px] uppercase tracking-[0.2em] font-mono px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                  SYSTEM ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                <span className="uppercase tracking-widest font-mono text-[10px]">Cinema Control Hub</span>
                <span className="text-zinc-700">•</span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                  <RefreshCw className="w-3 h-3 text-emerald-400" /> Synced {lastSyncTime}
                </span>
              </p>
            </div>
          </div>

          {/* Live Stream Simulator Toggle (Mobile) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-all ${
                isSimulating
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
              }`}
            >
              <Radio className={`w-3 h-3 ${isSimulating ? 'animate-ping text-emerald-400' : ''}`} />
              {isSimulating ? 'LIVE' : 'PAUSED'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-[#0a0a0a] p-1.5 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('command')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-[0.15em] font-medium transition-all whitespace-nowrap ${
              activeTab === 'command'
                ? 'text-white border-b-2 border-[#D4AF37] bg-zinc-900/60 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#D4AF37]" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-[0.15em] font-medium transition-all whitespace-nowrap ${
              activeTab === 'planner'
                ? 'text-white border-b-2 border-[#D4AF37] bg-zinc-900/60 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
            Planner
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-[0.15em] font-medium transition-all whitespace-nowrap ${
              activeTab === 'journal'
                ? 'text-white border-b-2 border-[#D4AF37] bg-zinc-900/60 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            Journal
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-[0.15em] font-medium transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'text-white border-b-2 border-[#D4AF37] bg-zinc-900/60 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#D4AF37]" />
            Analytics
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs uppercase tracking-[0.15em] font-medium transition-all whitespace-nowrap ${
              activeTab === 'copilot'
                ? 'text-white border-b-2 border-[#D4AF37] bg-zinc-900/60 font-semibold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            Copilot Studio
          </button>
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-3">
          {/* Live Feed Toggle */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            title={isSimulating ? "Pause live engagement metrics stream" : "Start live engagement metrics stream"}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider border transition-all ${
              isSimulating
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'bg-[#0a0a0a] border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Radio className={`w-3 h-3 ${isSimulating ? 'text-emerald-400 animate-pulse' : ''}`} />
            {isSimulating ? 'LIVE FEED' : 'PAUSED'}
          </button>

          <button
            onClick={onOpenConnectionsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-zinc-900 border border-zinc-800 hover:border-[#D4AF37]/50 text-zinc-300 text-xs font-mono uppercase tracking-wider transition-all"
            title="Configure WordPress REST API & Staging/Production sync"
          >
            <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
            WP Sync
          </button>

          <button
            onClick={onOpenNewJournal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-medium uppercase tracking-wider transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
            + Film Log
          </button>

          <button
            onClick={onOpenNewPost}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            Create Entry
          </button>
        </div>

      </div>
    </header>
  );
};
