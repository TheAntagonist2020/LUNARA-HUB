import React from 'react';
import { SocialPost, FilmJournalEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BookOpen, ExternalLink, FileClock, Inbox, RefreshCw, Zap } from 'lucide-react';

// Everything on this tab is measured, not estimated: the site's published
// posts (synced into the journal), the drafts and pitches on the site, and
// which dispatch services are connected. Social reach numbers are not shown
// because no free integration reports them to the hub — the house rule is
// real state or an honest empty, never a made-up metric.

interface AnalyticsDashboardProps {
  posts: SocialPost[];
  journalEntries: FilmJournalEntry[];
}

interface Draft {
  id: number;
  title: string;
  postType: string;
  modified: string;
  editUrl: string;
}

interface PitchSummary {
  counts: Record<string, number>;
  sources: Array<{ name: string; count: number }>;
  pitchMode: boolean;
}

interface Health {
  aiProviderOrder: string[];
  integrations: { typefullyKey: boolean; bufferKey: boolean; wordpressWrite: boolean };
}

// Validated pair for the dark surface (OKLCH band, CVD and contrast checks pass).
const REVIEW_COLOR = '#A8862E';
const DISPATCH_COLOR = '#3B7DD8';
const SURFACE = '#0a0a0a';
const WEEKS = 10;
const DAY = 24 * 60 * 60 * 1000;

const weekStart = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
};
const weekLabel = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
const isReview = (e: FilmJournalEntry) => e.id.startsWith('wp-review-');
const isSynced = (e: FilmJournalEntry) => e.id.startsWith('wp-');

const panel = 'bg-zinc-900/90 rounded-2xl border border-zinc-800';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ posts, journalEntries }) => {
  const [drafts, setDrafts] = React.useState<Draft[] | null>(null);
  const [pitches, setPitches] = React.useState<PitchSummary | null>(null);
  const [health, setHealth] = React.useState<Health | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const problems: string[] = [];
    const get = async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `${url} answered HTTP ${res.status}`);
      return data;
    };
    await Promise.all([
      get('/api/wordpress/drafts')
        .then((d) => setDrafts(d.drafts || []))
        .catch((e) => {
          setDrafts(null);
          problems.push(`Drafts: ${e.message}`);
        }),
      get('/api/dispatch/pitches')
        .then((d) => {
          const list: any[] = d.pitches || [];
          const counts: Record<string, number> = {};
          const bySource: Record<string, number> = {};
          for (const p of list) {
            counts[p.status] = (counts[p.status] || 0) + 1;
            if (p.status === 'pending') bySource[p.source || 'Unknown'] = (bySource[p.source || 'Unknown'] || 0) + 1;
          }
          const sources = Object.entries(bySource)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
          setPitches({ counts, sources, pitchMode: Boolean(d.pitchMode) });
        })
        .catch((e) => {
          setPitches(null);
          problems.push(`Pitches: ${e.message}`);
        }),
      get('/api/health')
        .then((d) => setHealth(d))
        .catch(() => setHealth(null)),
    ]);
    setErrors(problems);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // --- Published output, from the posts synced off the live site ---------
  const synced = journalEntries.filter(isSynced);
  const now = Date.now();
  const last30 = synced.filter((e) => now - Date.parse(e.dateWatched) < 30 * DAY);
  const reviews30 = last30.filter(isReview).length;
  const dispatches30 = last30.length - reviews30;

  const weeks = React.useMemo(() => {
    const thisWeek = weekStart(new Date());
    const rows = Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(thisWeek.getTime() - (WEEKS - 1 - i) * 7 * DAY);
      return { start, label: weekLabel(start), reviews: 0, dispatches: 0 };
    });
    for (const e of synced) {
      const t = Date.parse(e.dateWatched);
      if (!t) continue;
      const idx = Math.floor((weekStart(new Date(t)).getTime() - rows[0].start.getTime()) / (7 * DAY));
      if (idx < 0 || idx >= rows.length) continue;
      if (isReview(e)) rows[idx].reviews++;
      else rows[idx].dispatches++;
    }
    return rows;
  }, [synced]);

  // The site sync returns a window per type, so the earliest weeks may be
  // short — say so under the chart rather than let a low bar lie.
  const oldestSynced = synced.reduce((min, e) => {
    const t = Date.parse(e.dateWatched);
    return t && t < min ? t : min;
  }, Infinity);
  const windowStart = weeks[0].start.getTime();
  const windowIncomplete = synced.length > 0 && oldestSynced > windowStart;

  const queued = posts.filter((p) => p.status === 'scheduled').length;
  const publishedLocal = posts.filter((p) => p.status === 'published').length;

  const pending = pitches?.counts.pending || 0;
  const approved = pitches?.counts.approved || 0;
  const written = pitches?.counts.written || 0;
  const passed = pitches?.counts.passed || 0;
  const funnelMax = Math.max(1, pending, approved, written, passed);

  const dispatchCount = (health?.integrations.typefullyKey ? 1 : 0) + (health?.integrations.bufferKey ? 1 : 0);

  const Tile: React.FC<{ label: string; value: React.ReactNode; note: React.ReactNode; Icon: React.ElementType }> = ({ label, value, note, Icon }) => (
    <div className={`${panel} p-6 space-y-1`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-semibold">{label}</p>
        <Icon className="w-4 h-4 text-[#D4AF37]/50" />
      </div>
      <p className="text-4xl font-serif text-zinc-100">{value}</p>
      <p className="text-[10px] text-zinc-400 font-mono pt-1">{note}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className={`${panel} flex flex-col md:flex-row md:items-center justify-between gap-4 p-6`}>
        <div>
          <h2 className="font-serif text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Site Output</span>
            <span className="text-xs font-mono font-normal bg-zinc-800 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-md">MEASURED</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            What lunarafilm.com and the Dispatch pipeline actually did. Every number here was counted, none estimated.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {errors.length > 0 && (
        <div className={`${panel} p-4 space-y-1`}>
          {errors.map((e) => (
            <p key={e} className="text-xs text-zinc-400 font-mono">{e}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Tile
          label="Published · 30 days"
          value={synced.length ? last30.length : '—'}
          note={synced.length ? `${reviews30} review${reviews30 === 1 ? '' : 's'} · ${dispatches30} dispatch${dispatches30 === 1 ? '' : 'es'}` : 'Sync the journal from the site first'}
          Icon={BookOpen}
        />
        <Tile
          label="Awaiting review"
          value={drafts ? drafts.length : '—'}
          note={drafts ? 'Site drafts from Dispatch & Claude' : 'Needs the Application Password'}
          Icon={FileClock}
        />
        <Tile
          label="Pitches waiting"
          value={pitches ? pending : '—'}
          note={pitches ? `${written} written · ${passed} passed · pitch mode ${pitches.pitchMode ? 'on' : 'off'}` : 'Needs Dispatch 3.3.0 on the site'}
          Icon={Inbox}
        />
        <Tile
          label="Social dispatch"
          value={health ? `${dispatchCount} of 2` : '—'}
          note={health ? `Typefully ${health.integrations.typefullyKey ? 'on' : 'off'} · Buffer ${health.integrations.bufferKey ? 'on' : 'off'}` : 'Hub health unavailable'}
          Icon={Zap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${panel} lg:col-span-8 p-6 space-y-4`}>
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="font-serif text-lg font-bold text-zinc-100">Published per week</h3>
            <p className="text-xs text-zinc-400">Reviews and dispatches that went live on lunarafilm.com, last {WEEKS} weeks</p>
          </div>
          {synced.length === 0 ? (
            <p className="text-xs text-zinc-500 py-16 text-center">No site posts synced yet. Open the Journal tab and sync from WordPress.</p>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} barCategoryGap="30%">
                  <XAxis dataKey="label" stroke="#52525b" fontSize={11} tickLine={false} axisLine={{ stroke: '#27272a' }} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ backgroundColor: SURFACE, borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5', fontSize: 12 }}
                    labelFormatter={(l) => `Week of ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} iconType="circle" iconSize={8} />
                  <Bar dataKey="reviews" name="Reviews" stackId="out" fill={REVIEW_COLOR} stroke={SURFACE} strokeWidth={2} />
                  <Bar dataKey="dispatches" name="Dispatches" stackId="out" fill={DISPATCH_COLOR} stroke={SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {windowIncomplete && (
            <p className="text-[11px] text-zinc-500">
              The site sync returns its latest posts per type, and the earliest it returned is from {weekLabel(new Date(oldestSynced))} — weeks before that can look lower than they were.
            </p>
          )}
        </div>

        <div className={`${panel} lg:col-span-4 p-6 space-y-4`}>
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="font-serif text-lg font-bold text-zinc-100">Pitch funnel</h3>
            <p className="text-xs text-zinc-400">Where Dispatch's finds stand right now</p>
          </div>
          {!pitches ? (
            <p className="text-xs text-zinc-500">Pitch gate not reachable.</p>
          ) : (
            <div className="space-y-3">
              {[
                ['Waiting on you', pending],
                ['With the writer', approved],
                ['Drafted', written],
                ['Passed', passed],
              ].map(([label, n]) => (
                <div key={String(label)} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{label}</span>
                    <span className="font-mono text-zinc-400">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
                    <div className="h-full rounded-full bg-[#D4AF37]/70" style={{ width: `${(Number(n) / funnelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
              {pitches.sources.length > 0 && (
                <div className="pt-3 border-t border-zinc-800/80 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Waiting, by outlet</p>
                  {pitches.sources.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 truncate">{s.name}</span>
                      <span className="font-mono text-zinc-500">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${panel} lg:col-span-7 p-6 space-y-4`}>
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="font-serif text-lg font-bold text-zinc-100">Latest drafts on the site</h3>
            <p className="text-xs text-zinc-400">Newest first — open in wp-admin to review and publish</p>
          </div>
          {!drafts ? (
            <p className="text-xs text-zinc-500">Drafts need WP_USERNAME + WP_APP_PASSWORD in .env.</p>
          ) : drafts.length === 0 ? (
            <p className="text-xs text-zinc-500">Nothing waiting. The next approved pitch lands here.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/80">
              {drafts.slice(0, 8).map((d) => (
                <li key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-zinc-200 line-clamp-1">{d.title}</p>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      {d.postType} · {new Date(d.modified).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <a href={d.editUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[#D4AF37] hover:underline flex items-center gap-1">
                    Edit <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${panel} lg:col-span-5 p-6 space-y-3`}>
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="font-serif text-lg font-bold text-zinc-100">Social reach</h3>
            <p className="text-xs text-zinc-400">Not measured here</p>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Followers, likes, and reach are not connected. Typefully and Buffer do not report analytics to the hub on
            the plans in use, and the hub never shows a number it did not count. Read reach in each app's own dashboard.
          </p>
          <p className="text-xs text-zinc-500 font-mono">
            Local queue: {queued} scheduled · {publishedLocal} marked published
          </p>
        </div>
      </div>
    </div>
  );
};
