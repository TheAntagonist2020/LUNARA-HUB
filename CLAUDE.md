# LUNARA FILM Hub

Local dashboard + publishing cockpit for lunarafilm.com (Dalton's film journal).
React 19 + Vite frontend (opens on the swipeable Newsreel,
`src/components/Newsreel.tsx` + `src/components/newsreel/`), Express backend
in `server.ts` (single file), run with
`npm run dev` at http://localhost:3000. Type-check with `npm run lint`
(tsc --noEmit); production: `npm run build` then `npm start`.

Installable as a PWA (manifest + icons in `public/`, pass-through `sw.js` that
must never cache — live state only). Server binds 0.0.0.0 and prints its LAN
URL for phone access; remote access is Tailscale (free tier), never a public
tunnel — see README "On your phone".

## Design intent: $0 marginal cost

Everything runs on services Dalton already pays for. Never add a paid API when
a subscription-covered or free-tier path exists. AI provider chain (server.ts):
Claude Code CLI (subscription) → Gemini free tier → offline templates. Forced
via `AI_PROVIDER`; auto-detects otherwise.

## Configuration (.env — never committed; repo is PUBLIC, no secrets in code)

- `AI_PROVIDER`, `CLAUDE_CLI`, `CLAUDE_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`
- `WP_SITE` (lunarafilm.com), `WP_POST_TYPES` (review,journal,posts)
- `WP_USERNAME` + `WP_APP_PASSWORD` — Application Password; arms the media
  pipeline (wp-admin → Users → Profile → Application Passwords)
- `TYPEFULLY_API_KEY` — Typefully → Settings → API (**API v2**; v1 died
  2026-06-15, v1 keys don't work). Optional `TYPEFULLY_SOCIAL_SET_ID`,
  `TYPEFULLY_PLATFORMS`
- `BUFFER_API_KEY` — Buffer → Settings → API (GraphQL, Free plan OK);
  optional `BUFFER_CHANNEL_IDS`
- `TMDB_API_KEY` — free; official key art + official trailers in the Newsreel
  (v3 key or v4 read token). `NEWS_FEEDS` / `NEWS_TRAILER_CHANNELS` replace
  the default wire sources
- `MEDIA_VAULT_DIR` (default ./media-vault, gitignored), `PORT`. The vault is
  rebuildable from the site's media library: `npm run vault:backfill`
  (scripts/vault-backfill.mjs) — idempotent, `--since YYYY-MM` / `--all` /
  `--limit N`

`GET /api/health` reports which integrations are armed — it is the single
source of truth the dashboard tiles, Copilot Studio banner, and connections
modal all read. Keep any new integration reporting there.

## Server endpoints (server.ts)

- `POST /api/ai/generate-social`, `/api/ai/polish-copy` (legacy `/api/gemini/*`
  aliases kept) — provider chain, returns `provider` used
- `GET /api/wordpress/journal` — public REST pull of published posts
- `GET /api/wordpress/drafts` — authenticated list of drafts awaiting review
  (Lunara Dispatch + Claude output; feeds the dashboard's Awaiting Review
  panel). Site news intake is the Dispatch plugin alone — see the playbook's
  Automation architecture section
- `GET /api/dispatch/pitches`, `POST /api/dispatch/pitches/decide`,
  `POST /api/dispatch/pitch-mode` — the Pitches inbox (dashboard): relays to
  Lunara Dispatch 3.3.0's pitch gate (`lunara/v1/dispatch/pitches*`, same
  Application Password). With pitch mode on, Dispatch files pitches instead
  of drafts; only the ones Dalton approves (with his optional angle) get
  written. The store lives on the site; the hub keeps no pitch state
- `POST /api/wordpress/featured-image` — image URL → media-vault backup →
  WP media library → featured image (supports `postType` for CPTs)
- `POST /api/typefully/draft` — content (+ optional official `imageUrl`) →
  Typefully v2 drafts (or next free slot); `GET /api/typefully/status` is the
  real key check
- `GET /api/buffer/channels`, `POST /api/buffer/post` — Buffer queue / share
  next / draft (never publish-now)
- `GET /api/news/feed` — the Newsreel wire: trade RSS + official studio
  YouTube trailers, enriched with TMDB art/trailers; cached 10 min,
  `?refresh=1`, `?wait=0`. Read-only — never creates site drafts
- `POST /api/news/take` — hot take + social copy for a wire story via the
  provider chain, written as Dalton from **`voice/newsreel-voice.md`** (his
  journal voice rules + lines from his published posts; re-read on change).
  Drafts using banned phrases get one rewrite. No model → no take (canned
  lines can't sound like him)
- `POST /api/news/refine` — the Workshop: Dalton's notes + the current draft
  → Claude (as his editor) returns a reply and a revised take/post, same
  voice file and voice check. Stateless; the thread lives in the browser

## Site facts (lunarafilm.com — WordPress.com Atomic)

- CPTs: `journal` (news/dispatches), `review` (long-form criticism); both use
  their slug as REST base (`wp/v2/journal/{id}`)
- Custom MCP server on the site: "IsOnWP MCP Abilities" at
  `/wp-json/mcp/lunarafilm` (URL-token auth)
- Review posters are auto-sideloaded from TMDB by the site's "Lunara Database
  Engine" plugin — set IMDb id, artwork follows
- Full journal field reference and standing media rules: see
  **PUBLISHING-PLAYBOOK.md** (read it before touching anything that publishes)

## House rules

- Featured image is the hero; never place hero images in post content
- Trailers go in `_lunara_trailer_*` meta, never as raw embeds
- Official assets only, always credited, always alt-texted. In the Newsreel,
  outlet feed photos are display-only (`image.official: false`); only TMDB
  key art / official trailer stills may be attached to social posts
- Every uploaded image gets a media-vault backup
- No fake data in the UI: dashboards show real state or honest empty/demo
  labels — never fabricated metrics (the original AI Studio export did this;
  it has been removed and must not return)
