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
cp .env.example .env

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

## Typefully dispatch (your existing Typefully account)

Get an API key from **Typefully → Settings → Integrations → API** and set
`TYPEFULLY_API_KEY` in `.env`. The **⚡ Send to Typefully** buttons in the AI
Copilot Studio then push generated copy straight into your Typefully drafts.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Vite HMR at `localhost:3000` |
| `npm run build` | Production build into `dist/` |
| `npm start` | Serve the production build (`NODE_ENV=production node dist/server.cjs`) |
| `npm run lint` | Type-check (`tsc --noEmit`) |

## Health check

`GET http://localhost:3000/api/health` reports which AI providers are active
and which integrations are configured — useful when wiring up `.env`.

## Security notes

- `.env` is gitignored — keys never leave your machine. Don't commit them.
- An earlier version of this repo contained a hardcoded WordPress Application
  Password in `src/components/InstanceConnectionsModal.tsx`. It has been
  removed, but it lives in git history — if that password was real, **revoke
  it** (WP Admin → Users → Profile → Application Passwords) and create a new
  one.
