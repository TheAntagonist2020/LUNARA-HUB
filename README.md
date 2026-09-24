# LUNARA FILM Hub

Standalone film journal hub and social media control center for LUNARA FILM —
configured to run **locally** at zero marginal cost, using only services you
already pay for.

## Monthly cost breakdown

| Piece | What it uses | Extra cost |
| --- | --- | --- |
| The app itself | Runs on your machine (Node or Bun) | **$0** |
| AI copy generation | Your existing **Claude subscription** via the Claude Code CLI, or the **Gemini free tier**, or built-in offline templates | **$0** |
| Film journal sync | **lunarafilm.com** public REST API — included in your WordPress.com plan | **$0** |
| Social dispatch | **Typefully** API v2 — included with your Typefully account; **Buffer** GraphQL API — works on Buffer's Free plan | **$0** |
| Newsreel (movie news wire) | Public trade RSS feeds, official studio YouTube feeds, and a free **TMDB** key for official key art | **$0** |

No cloud hosting, no pay-per-token API bills, no new subscriptions.

## Quick start

```bash
# 1. Install dependencies (bun is fastest; npm works too)
bun install        # or: npm install

# 2. Create your local config — answer the prompts, it writes .env for you
npm run setup

# 3. Run it
npm run dev        # → http://localhost:3000
```

(`npm run setup` is the recommended way to create `.env` — it can't produce
commented-out keys or formatting mistakes. Hand-copying `.env.example` still
works if you prefer.)

That's it — the app is fully functional with **zero keys configured**: AI
features fall back to deterministic offline templates, and the Newsreel runs
on public feeds. Add the integrations below as you want them.

## The Newsreel — swipeable movie news

The hub opens on the **Newsreel**: a mobile-first deck of movie news cards,
dark and full-bleed, one story at a time.

- **Swipe right — "Print it"**: the story goes to your **Shortlist** for the
  social desk. **Swipe left — "Cut"**: pass. **Tap** a card for the full story,
  the trailer, and the take. Undo brings back the last swipe. On a keyboard:
  `→` print, `←` cut, `↑`/`Enter` open, `Z` undo, `T` take.
- **Sources (all free):** the trade feeds Lunara Dispatch watches (Deadline,
  Variety, IndieWire, World of Reel, EW, The Film Stage, The Playlist, Screen
  Daily) plus THR, and the **official YouTube channels** of 17 studios and
  distributors for trailer drops. Filter by Trailers, Casting, Box Office,
  Awards & Fests, Streaming, Reviews. The "N outlets" badge is a real count of
  outlets on the wire covering the same film.
- **Imagery and trailers:** studio trailer cards use the trailer's own still.
  With a free `TMDB_API_KEY`, news stories get the film's **official key art**
  and **official trailer** (verified against the YouTube channel name), and
  the detail sheet shows the poster, release date, and synopsis. The
  Lunara Database Engine's TMDB key works here too.
- **Hot takes:** the take runs through the same Claude CLI → Gemini →
  offline-template chain as the Copilot Studio, at three heat levels (Mild,
  Hot, Scorching). It's built only from the outlet's reported facts: no
  invented dates, numbers, or quotes. Offline templates are labeled as templates.
- **Dispatch:** each take becomes an editable post (X and Bluesky character
  counts, `via Outlet` credit, link) that you can send to **Typefully** (draft or
  next free slot) or **Buffer** (queue, share next, or draft).
- **Official art only:** photos from an outlet's feed are display-only. Only
  TMDB key art or an official trailer still can ride along on a social post,
  and it gets a media-vault backup like every other asset that ships.

The Newsreel only reads. It never writes site drafts: Lunara Dispatch stays the
sole site intake (see the playbook). Swap sources with `NEWS_FEEDS` /
`NEWS_TRAILER_CHANNELS` in `.env`.

## AI providers (pick any, or none)

The server tries providers cheapest-first: **Claude CLI → Gemini → offline
templates**. Control it with `AI_PROVIDER` in `.env`
(`auto` | `claude` | `gemini` | `template`).

### Option A — your Claude subscription ($0 extra, recommended)

You already pay for Claude. The Claude Code CLI's headless mode bills against
that subscription instead of per-token API pricing.

```bash
npm install -g @anthropic-ai/claude-code
claude   # run once, choose "Log in with Claude account"
```

The server auto-detects the CLI. Optional `.env` tweaks: `CLAUDE_CLI` (binary
path) and `CLAUDE_MODEL` (e.g. `sonnet` for speed, `opus` for quality).

### Option B — Gemini free tier ($0)

Grab a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
and set `GEMINI_API_KEY` in `.env`. The free-tier rate limits are more than
enough for personal use of this hub.

### Option C — offline templates ($0, no network)

Set `AI_PROVIDER=template` (or simply configure nothing). Deterministic
LUNARA-styled copy, generated locally.

## WordPress journal sync (your existing WordPress.com plan)

The **Journal** tab has a **“Sync lunarafilm.com”** button that pulls your
published posts (`review`, `journal`, and standard posts) through the public
WordPress.com REST API into the journal — no credentials needed for published
content. Change the source with `WP_SITE` / `WP_POST_TYPES` in `.env`.

## Featured images & the media vault

`POST /api/wordpress/featured-image` with `{ "postId": 123, "postType": "journal", "imageUrl": "https://...jpg", "alt": "..." }` makes the hub:

1. download the image from the URL,
2. **save a backup copy to `media-vault/YYYY-MM/` on your machine** (always, even if the upload fails),
3. upload it to your WordPress media library, and
4. set it as that post's featured image.

Steps 3–4 need a one-time setup: create an Application Password in
**wp-admin → Users → Profile → Application Passwords** and put
`WP_USERNAME` + `WP_APP_PASSWORD` in `.env`. The `media-vault/` folder is
gitignored — it's your local archive of every asset that ships to the site.

**The vault is rebuildable — you can never truly lose it.** The site's media
library is the master archive; on any fresh machine:

```bash
npm run vault:backfill                    # media from the last 12 months
npm run vault:backfill -- --since 2026-08 # from a given month onward
npm run vault:backfill -- --all           # the entire library (thousands of files)
```

It's idempotent (already-downloaded files are skipped) and honors
`MEDIA_VAULT_DIR` — point that at a cloud-synced folder (OneDrive /
Proton Drive) in `.env` and the vault backs itself up off-device too.

## Typefully dispatch (your existing Typefully account)

Get an API key from **Typefully → Settings → API** and set
`TYPEFULLY_API_KEY` in `.env`. The hub uses **Typefully API v2**. Typefully
switched v1 off on 15 June 2026, and v1 keys don't work with v2, so if your
key predates that, make a new one. Drafts go to the first social set on the
account and to every platform connected in it; narrow that with
`TYPEFULLY_SOCIAL_SET_ID` / `TYPEFULLY_PLATFORMS`. The Newsreel's dispatch
panel and the **⚡ Typefully** buttons in the AI Copilot Studio push copy
straight into your drafts (or the next free queue slot). `npm run doctor`
makes a real v2 call, so a stale key shows up there instead of on your first post.

## Buffer dispatch (Buffer's Free plan works)

Create a personal key in **Buffer → Settings → API** and set `BUFFER_API_KEY`
in `.env`. The Newsreel's dispatch panel lists your connected text channels
(X, Threads, Bluesky, Mastodon, LinkedIn, Facebook) and sends to the queue,
"share next", or drafts. It never publishes instantly. Pre-pick channels with
`BUFFER_CHANNEL_IDS`. Instagram, TikTok, and YouTube need media-specific
settings, so schedule those in Buffer itself.

## On your phone

The hub is an installable web app (PWA) — it gets a LUNARA home-screen icon
and runs full-screen like a native app. Three tiers, all $0:

### Same Wi-Fi (zero setup)

1. Start the hub on your PC (`npm run dev` or `npm start`). The console now
   prints a line like `[phone] same Wi-Fi: http://192.168.1.23:3000` — if
   Windows asks about the firewall the first time, click **Allow**.
2. Open that address in your phone's browser.
3. Install it: **iPhone** — Share → *Add to Home Screen*. **Android** —
   menu (⋮) → *Add to Home screen* / *Install app*.

### Anywhere (Tailscale, free tier)

Same Wi-Fi only works at home. [Tailscale](https://tailscale.com) (free for
personal use) gives your PC a private address that works from anywhere, with
nothing exposed to the public internet:

1. Install Tailscale on the PC and the phone, sign both into the same account.
2. On the phone, open `http://<your-pc-name>:3000` (the name shown in the
   Tailscale app). Add to home screen the same way.

The PC has to be on and running the hub — the tradeoff for $0 hosting.

### Anywhere, PC off (no hub needed)

Publishing doesn't require the hub at all — the site is the always-on part:

- **Claude app / claude.ai** on the phone: a Claude Code session on this repo
  can list drafts, write dispatches, and publish to lunarafilm.com directly
  (the site's MCP bridge works from anywhere).
- **wp-admin** in the phone browser: review and publish Dispatch drafts.
- **Typefully / Buffer apps**: the social queue.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Vite HMR at `localhost:3000` |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the production build (works on Windows, macOS, and Linux) |
| `npm run update` | **One-command update**: pull → install if needed → build → restart the running hub |
| `npm run setup` | Interactive `.env` wizard — writes a guaranteed-correct config |
| `npm run doctor` | Connection self-check with remedies |
| `npm run vault:backfill` | Rebuild the media vault from the site's library |
| `npm run lint` | Type-check (`tsc --noEmit`) |

Starting the hub while it's already running is safe — it tells you where the
running copy is instead of crashing. `npm run update` hands off from the old
build to the new one automatically (a loopback-only restart hook; nothing on
the network can trigger it).

## Publishing rules

The standing media workflow — featured-image-as-hero, trailers in the site's
dedicated fields, official assets only, vault backups, and lunarafilm.com's
exact field reference — lives in **[PUBLISHING-PLAYBOOK.md](PUBLISHING-PLAYBOOK.md)**.

## Health check

`GET http://localhost:3000/api/health` reports which AI providers are active
and which integrations are configured — useful when wiring up `.env`.

## Security notes

- `.env` is gitignored — keys never leave your machine. Don't commit them.
- The original AI Studio export shipped with fabricated sample credentials
  hardcoded in `src/components/InstanceConnectionsModal.tsx` (a fake
  WordPress Application Password and Typefully key). They were never real and
  have been removed — real keys belong only in `.env`, never in source.
