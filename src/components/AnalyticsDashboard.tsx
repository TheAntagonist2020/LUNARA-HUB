import React, { useState } from 'react';
import { SocialPost, PlatformMetric } from '../types';
import { PlatformIcon, getPlatformBg } from './PlatformIcon';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, MousePointerClick, Eye, Share2, Award, ExternalLink, Calendar } from 'lucide-react';

interface AnalyticsDashboardProps {
  posts: SocialPost[];
  platformMetrics: PlatformMetric[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  posts,
  platformMetrics,
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('7d');

  // Trend data for Recharts
  const trendData = [
    { day: 'Mon', reach: 142000, clicks: 3800, engagement: 7.2 },
    { day: 'Tue', reach: 189000, clicks: 5200, engagement: 8.4 },
    { day: 'Wed', reach: 210000, clicks: 6100, engagement: 9.1 },
    { day: 'Thu', reach: 175000, clicks: 4900, engagement: 7.8 },
    { day: 'Fri', reach: 290000, clicks: 8400, engagement: 11.2 },
    { day: 'Sat', reach: 340000, clicks: 10200, engagement: 12.5 },
    { day: 'Sun', reach: 310000, clicks: 9100, engagement: 10.8 },
  ];

  const platformPieData = platformMetrics.map((pm) => ({
    name: pm.name,
    value: pm.reach24h,
    color: pm.color,
  }));

  // Top performing posts sorted by total engagement likes
  const topPosts = [...posts].sort(
    (a, b) => b.engagementStats.likes + b.engagementStats.clicks - (a.engagementStats.likes + a.engagementStats.clicks)
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="font-serif text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Real-Time Analytics & Audience Conversion</span>
            <span className="text-xs font-mono font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              LIVE METRICS
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Analyze LUNARA FILM social media reach, engagement rates, and referral clicks to lunarafilm.com.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 self-start md:self-auto">
          {(['7d', '30d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                timeframe === tf
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Reach & Conversion Area Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Impressions vs LunaraFilm.com Clicks</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Weekly traffic trajectory converted from movie reviews & festival social posts
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Impressions
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Website Clicks
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', color: '#f4f4f5' }}
                />
                <Area type="monotone" dataKey="reach" stroke="#f59e0b" fillOpacity={1} fill="url(#colorReach)" strokeWidth={2} />
                <Area type="monotone" dataKey="clicks" stroke="#10b981" fillOpacity={1} fill="url(#colorClicks)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Distribution Pie Chart (4 Cols) */}
        <div className="lg:col-span-4 bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 space-y-4">
          <div className="border-b border-zinc-800 pb-3">
            <h3 className="font-serif text-lg font-bold text-zinc-100">
              Platform Reach Share
            </h3>
            <p className="text-xs text-zinc-400">
              Audience breakdown across platforms
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platformPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {platformPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            {platformMetrics.map((pm) => (
              <div key={pm.platform} className="flex items-center justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pm.color }} />
                  {pm.name}
                </span>
                <span className="font-mono text-zinc-400">
                  {((pm.reach24h / 1266000) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Top Converting Posts Table */}
      <div className="bg-zinc-900/90 rounded-2xl p-6 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Top Performing LUNARA FILM Content</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Sorted by combined engagement and referral link clickthroughs
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950 text-zinc-400 uppercase font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Film Feature</th>
                <th className="py-3 px-4">Likes</th>
                <th className="py-3 px-4">Shares</th>
                <th className="py-3 px-4">Website Clicks</th>
                <th className="py-3 px-4">Estimated Reach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {topPosts.map((post) => (
                <tr key={post.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full border ${getPlatformBg(post.platform)}`}>
                      <PlatformIcon platform={post.platform} showLabel />
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-amber-300">
                    {post.filmTitle || 'Cinephile Editorial'}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-zinc-100">
                    {post.engagementStats.likes.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-300">
                    {post.engagementStats.shares.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                    {post.engagementStats.clicks.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-400">
                    {post.engagementStats.reach.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
