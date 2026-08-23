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
| Social dispatch | **Typefully** drafts API — included with your Typefully account | **$0** |

No cloud hosting, no pay-per-token API bills, no new subscriptions.

## Quick start

```bash
# 1. Install dependencies (bun is fastest; npm works too)
bun install        # or: npm install

# 2. Create your local config
cp .env.example .env       # Windows cmd: copy .env.example .env

# 3. Run it
npm run dev        # → http://localhost:3000
```

That's it — the app is fully functional with **zero keys configured**: AI
features fall back to deterministic offline templates. Add the integrations
below as you want them.

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

## Typefully dispatch (your existing Typefully account)

Get an API key from **Typefully → Settings → Integrations → API** and set
`TYPEFULLY_API_KEY` in `.env`. The **⚡ Send to Typefully** buttons in the AI
Copilot Studio then push generated copy straight into your Typefully drafts.

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
- **Typefully app**: the social queue.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Vite HMR at `localhost:3000` |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the production build (works on Windows, macOS, and Linux) |
| `npm run lint` | Type-check (`tsc --noEmit`) |

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
