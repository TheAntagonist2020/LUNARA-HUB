# LUNARA Publishing Playbook

Standing rules for every post that ships to lunarafilm.com — journal and
review alike. This file is the durable version of the media workflow; any
AI session or human touching the pipeline follows it.

## Media rules (every post, no exceptions)

1. **Featured image is the hero.** The theme renders it. Never place a hero
   `<figure>` inside post content — that duplicates the featured image.
2. **Trailers go in the dedicated fields, never as raw embeds in content.**
   The site renders the player from post meta (keys below). This prevents
   image tripling (featured image + inline embed poster are often the same
   frame) and keeps the trailer link swappable if a video is taken down.
3. **Official assets only**: studio key art, official trailer stills/thumbnails,
   event press photos. Credit the source. Never watermarked re-upload thumbnails —
   verify the YouTube channel is official (e.g. via `youtube.com/oembed`).
4. **Every uploaded image also gets a local backup** in `media-vault/YYYY-MM/`
   (the hub's `/api/wordpress/featured-image` endpoint does this automatically).
5. **Image spec** (site validator, config 1.0.25): hard minimum 800×450,
   preferred 1200×630+, landscape ratio 1.5–2.1. Always set alt text.

## Site field reference (journal CPT)

Learned from live posts via `isonwp-inspect-post` — keep in sync if the
site's Journal Foundation plugin changes.

| Purpose | Meta key | Notes |
| --- | --- | --- |
| Featured image | `_thumbnail_id` | Attachment ID; upload via REST `wp/v2/media` |
| Trailer URL | `_lunara_trailer_url` | Full YouTube watch URL (official channel) |
| Trailer label | `_lunara_trailer_label` | e.g. "Film | Special Look" |
| Trailer credit | `_lunara_trailer_credit` | e.g. "Marvel Studios" |
| Trailer placement | `_lunara_trailer_placement` | `after_first_paragraph` |
| Deck | `journal_deck` + `_journal_deck: field_lunara_journal_deck` | ACF pair |
| SEO title/desc | `journal_seo_title` / `journal_seo_description` + `_`-key pairs | ACF pair |
| Sources | `journal_source_items*` + `_`-key pairs | ACF repeater; at least one required |

ACF fields need BOTH the value meta and the underscore key-reference meta
(`_field_name: field_lunara_...`) or the site's validator can't read them.

Taxonomies: `journal_section` (e.g. Signal), `journal_type` (News, Trailer,
Signal — trailer posts get News + Trailer).

Reviews: TMDB posters are auto-sideloaded as featured images by the
"Lunara Database Engine" plugin on the site — set the IMDb id and the site
handles review artwork itself.

## Automation architecture (decided 2026-08 — keep it this simple)

**Lunara Dispatch is the sole automated news intake.** Dalton's own plugin
polls its configured feeds, writes drafts in the journal voice, and attaches
featured images itself. New sources are added in the plugin's wp-admin
settings — nothing else.

Flow: **Dispatch → draft + featured image → "Needs Attention" IFTTT phone
ping → review (hub's Awaiting Review panel or wp-admin) → publish.**

Explicit decision: **no Feedly → IFTTT → capture inbound layer.** It was
designed, then rejected as over-complication before being built. Do not
resurrect it. IFTTT keeps exactly two Lunara jobs: the "Lunara — Needs
Attention" outbound ping and the Trakt watched-movie review reminder.

Roles: Dispatch = automated news drafts · Claude = breaking news, reviews,
and media on demand (this playbook) · Hub = the cockpit (real state, social
copy, Typefully, featured images).

Standing security notes: the Foundation bridge's `ifttt_operator` token was
scheduled for rotation (unknown daily ~7:30 AM caller); the `chatgpt_editor`
bridge profile (publish scope) is legacy and can be retired at Dalton's
discretion.

## Hub endpoints in this pipeline

- `POST /api/wordpress/featured-image` — URL → vault backup → media library
  → featured image. Needs `WP_USERNAME` + `WP_APP_PASSWORD` in `.env`.
- `GET /api/wordpress/journal` — pulls published posts into the Journal tab.
- `GET /api/wordpress/drafts` — drafts awaiting review (Dispatch + Claude
  output), shown on the dashboard. Needs the same WP credentials.
- `POST /api/typefully/draft` — copy → Typefully drafts/queue.
- `GET /api/health` — reports which of the above are armed.
