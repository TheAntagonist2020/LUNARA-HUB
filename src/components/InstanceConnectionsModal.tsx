import React, { useState } from 'react';
import { X, Globe, Key, Check, Copy, RefreshCw, Send, Database, ShieldCheck, Cpu, Code2, AlertCircle } from 'lucide-react';
import { FilmJournalEntry } from '../types';

interface InstanceConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  journalEntries: FilmJournalEntry[];
}

export const InstanceConnectionsModal: React.FC<InstanceConnectionsModalProps> = ({
  isOpen,
  onClose,
  journalEntries,
}) => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'typefully' | 'test' | 'code' | 'webhooks'>('endpoints');
  
  // Endpoint Config States
  const [primaryWpUrl, setPrimaryWpUrl] = useState('https://lunarafilm.com');
  const [wpUsername, setWpUsername] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [customPostType, setCustomPostType] = useState('review');
  const [showPassword, setShowPassword] = useState(false);

  // Typefully Integration States
  const [typefullyApiKey, setTypefullyApiKey] = useState('');
  const [typefullyAutoSchedule, setTypefullyAutoSchedule] = useState(true);
  const [typefullyTestStatus, setTypefullyTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [typefullyTestResult, setTypefullyTestResult] = useState<string>('');
  
  // Staging / Secondary Instances
  const [secondaryWpUrl, setSecondaryWpUrl] = useState('https://staging.lunarafilm.com');
  const [webhookUrl, setWebhookUrl] = useState('https://api.lunarafilm.com/v1/webhooks/journal-sync');

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  // Real end-to-end test: hub server health + live WordPress journal fetch.
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestOutput('[TESTING] Checking hub server integrations and live WordPress sync...\n');

    try {
      const healthRes = await fetch('/api/health');
      const health = await healthRes.json();

      const wpRes = await fetch('/api/wordpress/journal');
      const wp = await wpRes.json();

      const allGood = healthRes.ok && wpRes.ok && !wp.error;
      setTestStatus(allGood ? 'success' : 'error');
      setTestOutput(
        JSON.stringify(
          {
            hubServer: healthRes.ok ? 'OK' : `HTTP ${healthRes.status}`,
            aiProviderOrder: health.aiProviderOrder,
            integrations: health.integrations,
            wordpressSync: wpRes.ok
              ? `OK — ${wp.count} published posts readable from ${wp.site}`
              : `FAILED — ${wp.error || `HTTP ${wpRes.status}`}`,
            note: 'Credentials live in the hub .env (WP_USERNAME / WP_APP_PASSWORD / TYPEFULLY_API_KEY). wordpressWrite=true means the featured-image pipeline is armed.',
          },
          null,
          2
        )
      );
    } catch (err: any) {
      setTestStatus('error');
      setTestOutput(`Test failed: ${err.message}\nIs the hub server running? (npm run dev)`);
    }
  };

  const phpFunctionsSnippet = `<?php
/**
 * LUNARA FILM Journal & Reviews REST API Custom Fields Registration
 * Add this snippet to your active WordPress theme functions.php, Code Snippets plugin, or mu-plugin.
 *
 * Supports Custom Post Types: '${customPostType}', 'reviews', 'journal', 'post'
 */

add_action('rest_api_init', function () {
    // Post types to register Lunara fields for
    $post_types = array_unique(['${customPostType}', 'reviews', 'journal', 'post', 'review']);

    // Register Lunara Journal & Review CPT Meta Fields
    $meta_fields = [
        'lunara_section',
        'lunara_feature_homepage',
        'lunara_feature_priority',
        'lunara_signal_context_kicker',
        'lunara_article_details_kicker',
        'lunara_journal_cta_label',
        'lunara_journal_cta_url',
        'lunara_trailer_url',
        'lunara_trailer_placement',
        'lunara_trailer_label',
        'lunara_source_credit',
        'lunara_editorial_note',
        'lunara_provenance_json'
    ];

    foreach ($post_types as $pt) {
        foreach ($meta_fields as $field) {
            register_post_meta($pt, $field, [
                'show_in_rest' => true,
                'single'       => true,
                'type'         => 'string',
            ]);
        }
    }
});
`;

  const copyCode = () => {
    navigator.clipboard.writeText(phpFunctionsSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0a0a0a] rounded-xl border border-zinc-800 max-w-3xl w-full p-6 space-y-5 shadow-2xl animate-scaleUp text-zinc-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.2em] font-mono px-2 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
                MULTI-INSTANCE CONNECTIONS & REST API SYNC
              </span>
            </div>
            <h3 className="font-serif italic text-2xl font-bold text-zinc-100 mt-1">
              Connect Lunara Film Instances
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'endpoints'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            WordPress REST Credentials
          </button>

          <button
            onClick={() => setActiveTab('typefully')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'typefully'
                ? 'bg-zinc-800 text-sky-400 border border-sky-400/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            Typefully Queue API
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'test'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Live Sync Test
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'code'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            WP PHP Snippet
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all ${
              activeTab === 'webhooks'
                ? 'bg-zinc-800 text-[#D4AF37] border border-[#D4AF37]/40 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Webhooks
          </button>
        </div>

        {/* Tab 1: Endpoints */}
        {activeTab === 'endpoints' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-3 bg-[#050505] border border-zinc-800 rounded flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
              <p className="text-zinc-300 leading-relaxed">
                Live credentials are configured server-side in the hub's <strong>.env</strong> file
                (<code>WP_USERNAME</code>, <code>WP_APP_PASSWORD</code>, <code>TYPEFULLY_API_KEY</code>) — see
                README and PUBLISHING-PLAYBOOK.md. The fields below are reference only; use the{' '}
                <strong>Live Sync Test</strong> tab to verify what's actually armed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-3">
                <h4 className="font-mono text-[11px] text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Production Instance
                </h4>
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">WordPress Site URL</label>
                  <input
                    type="text"
                    value={primaryWpUrl}
                    onChange={(e) => setPrimaryWpUrl(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Admin Username</label>
                  <input
                    type="text"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider">Application Password</label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[10px] font-mono text-zinc-400 hover:text-[#D4AF37] transition-colors"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    placeholder="WP Admin → Users → Profile → Application Passwords"
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Custom Post Type (CPT) Slug</label>
                  <input
                    type="text"
                    value={customPostType}
                    onChange={(e) => setCustomPostType(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Presets:</span>
                    {['review', 'reviews', 'journal', 'post', 'film_review'].map((cpt) => (
                      <button
                        key={cpt}
                        type="button"
                        onClick={() => setCustomPostType(cpt)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                          customPostType === cpt
                            ? 'bg-[#D4AF37] text-black font-bold'
                            : 'bg-[#0a0a0a] text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        {cpt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-3">
                <h4 className="font-mono text-[11px] text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Staging Instance
                </h4>
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Staging Site URL</label>
                  <input
                    type="text"
                    value={secondaryWpUrl}
                    onChange={(e) => setSecondaryWpUrl(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">Webhook Listener Endpoint</label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Auto-sync enabled for newly published entries
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Typefully Integration */}
        {activeTab === 'typefully' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-3 bg-[#050505] border border-sky-900/40 rounded flex items-start gap-3">
              <Send className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <p className="text-zinc-300 leading-relaxed">
                Connect <strong>Typefully</strong> to directly dispatch Gemini AI film reviews, critical threads, and scheduled social content directly into your Typefully queue and drafts.
              </p>
            </div>

            <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-xs text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  Typefully v1 Drafts API Credentials
                </h4>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">
                  ENDPOINT: api.typefully.com/v1/drafts/
                </span>
              </div>

              <div>
                <label className="block text-zinc-400 font-mono text-[10px] uppercase tracking-wider mb-1">
                  Typefully API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={typefullyApiKey}
                    onChange={(e) => setTypefullyApiKey(e.target.value)}
                    placeholder="tf_live_..."
                    className="flex-1 bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2 text-zinc-200 font-mono focus:outline-none focus:border-sky-400"
                  />
                  <button
                    onClick={async () => {
                      setTypefullyTestStatus('testing');
                      setTypefullyTestResult('Checking the hub server for a configured Typefully key...');
                      try {
                        const res = await fetch('/api/health');
                        const health = await res.json();
                        const armed = Boolean(health?.integrations?.typefullyKey);
                        setTypefullyTestStatus(armed ? 'success' : 'error');
                        setTypefullyTestResult(
                          armed
                            ? 'TYPEFULLY_API_KEY is configured in .env — dispatch buttons in Copilot Studio and the Planner are live. The key itself is verified on your first real dispatch.'
                            : 'No TYPEFULLY_API_KEY in the hub .env. Add it (Typefully → Settings → Integrations → API), restart the hub, and test again.'
                        );
                      } catch (err: any) {
                        setTypefullyTestStatus('error');
                        setTypefullyTestResult(`Could not reach the hub server: ${err.message}`);
                      }
                    }}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-mono uppercase text-[10px] font-bold rounded tracking-wider transition-all"
                  >
                    {typefullyTestStatus === 'testing' ? 'Testing...' : 'Test Key'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-zinc-300 font-mono text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typefullyAutoSchedule}
                    onChange={(e) => setTypefullyAutoSchedule(e.target.checked)}
                    className="rounded border-zinc-800 bg-[#0a0a0a] text-sky-400 focus:ring-0"
                  />
                  <span>Auto-schedule to Typefully's next available queue slot when dispatched</span>
                </label>
              </div>

              {typefullyTestResult && (
                <pre className="p-3 bg-[#020202] border border-sky-900/40 rounded font-mono text-[10px] text-sky-300 overflow-x-auto leading-relaxed">
                  {typefullyTestResult}
                </pre>
              )}
            </div>
          </div>
        )}
        {activeTab === 'test' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-serif italic text-lg text-zinc-100 font-bold">REST API Handshake Test</h4>
                  <p className="text-zinc-400 text-[11px]">Send a test payload verifying WP REST credentials and metadata structure.</p>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="px-5 py-2 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                  {testStatus === 'testing' ? 'Testing Handshake...' : 'Run API Test'}
                </button>
              </div>

              {testOutput && (
                <pre className="p-4 bg-[#020202] border border-zinc-800 rounded font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed">
                  {testOutput}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: PHP Code */}
        {activeTab === 'code' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="flex justify-between items-center">
              <p className="text-zinc-400">Copy this helper snippet into your WordPress theme's <code>functions.php</code> to expose all Lunara Journal metadata via REST API:</p>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[#D4AF37] text-xs font-mono uppercase tracking-wider"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied Snippet' : 'Copy PHP Code'}
              </button>
            </div>

            <pre className="p-4 bg-[#020202] border border-zinc-800 rounded font-mono text-[11px] text-amber-200/90 overflow-x-auto leading-relaxed max-h-[300px]">
              {phpFunctionsSnippet}
            </pre>
          </div>
        )}

        {/* Tab 4: Webhooks */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 bg-[#050505] border border-zinc-800 rounded space-y-3">
              <h4 className="font-mono text-xs text-[#D4AF37] uppercase tracking-wider">Event Webhooks</h4>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                No webhooks are configured — the hub currently syncs by pulling from
                lunarafilm.com's public REST API (automatically on startup, or via the
                Journal tab's sync button). Real-time push webhooks are a possible future
                addition, not an active feature.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500">
            LUNARA MULTI-INSTANCE BRIDGE • READY FOR PRODUCTION
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 border border-[#D4AF37] text-[#D4AF37] uppercase text-[10px] tracking-[0.2em] font-bold hover:bg-[#D4AF37] hover:text-black transition-all rounded shadow-md"
          >
            Close Settings
          </button>
        </div>

      </div>
    </div>
  );
};
