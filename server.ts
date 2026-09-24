import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import { createHash } from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// ---------------------------------------------------------------------------
// AI PROVIDER CHAIN — cheapest-first, using what you already pay for:
//   1. "claude"   — Claude Code CLI headless mode. Covered by your existing
//                   Claude subscription (no per-token API billing).
//   2. "gemini"   — Google AI Studio key on the free tier.
//   3. "template" — deterministic offline templates. Always works, costs $0.
// Force a specific provider with AI_PROVIDER=claude|gemini|template (default: auto).
// ---------------------------------------------------------------------------

type ProviderName = "claude" | "gemini" | "template";

const CLAUDE_CLI = process.env.CLAUDE_CLI || "claude";
// npm on Windows installs the CLI as a claude.cmd shim, which Node can only
// launch through a shell. Only fixed args ever reach the shell — the prompt
// travels over stdin, so no user content needs shell escaping.
const NEEDS_SHELL = process.platform === "win32";

let claudeCliAvailable = false;
let claudeCliCheckedAt = 0;

function spawnClaudeCli(args: string[], stdin: string | null, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Node deprecates args arrays combined with shell:true (DEP0190), so on
    // Windows the fixed args are joined into the command string ourselves.
    const child = NEEDS_SHELL
      ? spawn(`"${CLAUDE_CLI}" ${args.join(" ")}`, { shell: true, windowsHide: true })
      : spawn(CLAUDE_CLI, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Claude CLI timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 300)}`));
      }
      resolve(stdout);
    });

    if (stdin !== null) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

async function checkClaudeCli(): Promise<boolean> {
  // Re-check a negative result every 60s so installing the CLI while the
  // server is running gets picked up without a restart.
  if (claudeCliAvailable || Date.now() - claudeCliCheckedAt < 60000) {
    return claudeCliAvailable;
  }
  claudeCliCheckedAt = Date.now();
  try {
    await spawnClaudeCli(["--version"], null, 10000);
    claudeCliAvailable = true;
  } catch {
    claudeCliAvailable = false;
  }
  return claudeCliAvailable;
}

async function runClaudeCli(prompt: string): Promise<string> {
  const args = ["-p", "--output-format", "json"];
  if (process.env.CLAUDE_MODEL) {
    args.push("--model", process.env.CLAUDE_MODEL);
  }
  const stdout = await spawnClaudeCli(args, prompt, 180000);
  let envelope: any = null;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    // Older CLI versions may emit plain text instead of a JSON envelope.
    return stdout;
  }
  if (envelope && typeof envelope === "object") {
    if (envelope.is_error) {
      throw new Error(String(envelope.result || "Claude CLI returned an error"));
    }
    return String(envelope.result ?? "");
  }
  return stdout;
}

// Model text may arrive fenced or with prose around it — carve out the JSON object.
function extractJsonObject(text: string): any {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

let gemini: GoogleGenAI | null = null;
function getGeminiAI() {
  if (!gemini && process.env.GEMINI_API_KEY) {
    gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "lunara-film-hub-local",
        },
      },
    });
  }
  return gemini;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

async function resolveProviderOrder(): Promise<ProviderName[]> {
  const pref = (process.env.AI_PROVIDER || "auto").toLowerCase();
  if (pref === "claude") return ["claude", "template"];
  if (pref === "gemini") return ["gemini", "template"];
  if (pref === "template") return ["template"];
  const order: ProviderName[] = [];
  if (await checkClaudeCli()) order.push("claude");
  if (process.env.GEMINI_API_KEY) order.push("gemini");
  order.push("template");
  return order;
}

// ---------------------------------------------------------------------------
// Social campaign generation
// ---------------------------------------------------------------------------

interface SocialParams {
  filmTitle?: string;
  director?: string;
  rating?: number;
  journalNotes?: string;
  targetPlatforms?: string[];
  tone?: string;
  articleUrl?: string;
}

function socialPromptBody(p: SocialParams): string {
  return `You are the lead Social Media Director and Chief Film Critic at LUNARA FILM (a sleek, high-brow yet accessible film journal & editorial website).
Create social media post variations for LUNARA FILM's social media platforms.

House voice (non-negotiable): savage enthusiasm. Opinion-forward — the take IS the post, and the point arrives in the first sentence. No throat-clearing, no "content creator" cadence, no "Hey film lovers!", no emoji spam, nothing corporate. Confident, specific, a little dangerous; wit over snark; write like a critic who loves movies too much to be polite about them.

Film Details:
- Title: ${p.filmTitle || "Untitled Film"}
- Director: ${p.director || "N/A"}
- Star Rating: ${p.rating ? `${p.rating}/5 Stars` : "Not rated"}
- Film Journal Notes/Review Snippet: ${p.journalNotes || "General film coverage and review."}
- Tone Strategy: ${p.tone || "Cinephile Editorial"}
- LUNARA FILM Website Link: ${p.articleUrl || "https://lunarafilm.com/reviews/latest"}
- Target Platforms requested: ${(p.targetPlatforms || ["Twitter/X", "Instagram", "Letterboxd", "TikTok"]).join(", ")}

Generate tailored posts with:
1. twitterCopy: Punchy X/Twitter post or thread hook (under 280 chars, stylish, film-nerd aesthetic).
2. instagramCaption: Engaging Instagram carousel/photo caption with formatting, paragraph breaks, and strong CTA to link in bio.
3. letterboxdReview: Sophisticated, sharp Letterboxd review snippet or log comment.
4. tikTokScript: A 15-30 second video script outline (Hook, On-screen text, Visual cue, Audio cue).
5. hashtags: Array of 5-8 relevant trending and niche film hashtags (e.g., #LunaraFilm, #Cinema, etc.).
6. engagementScore: Estimated viral potential score from 1-100.
7. engagementAdvice: 1 sentence advice on optimal timing or image asset pairing for max reach.`;
}

const SOCIAL_REQUIRED_KEYS = [
  "twitterCopy",
  "instagramCaption",
  "letterboxdReview",
  "tikTokScript",
  "hashtags",
  "engagementScore",
  "engagementAdvice",
];

function validateKeys(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj[key] === undefined || obj[key] === null) {
      throw new Error(`Model output missing required key: ${key}`);
    }
  }
  return obj;
}

function templateSocial(p: SocialParams) {
  const title = p.filmTitle || "Untitled Film";
  const notes = p.journalNotes || "A film worth your attention.";
  const rating = p.rating || 4.5;
  const url = p.articleUrl || "https://lunarafilm.com/reviews/latest";
  const stars = "★".repeat(Math.max(1, Math.min(5, Math.round(rating))));
  return {
    twitterCopy: `${title}${p.director ? ` (dir. ${p.director})` : ""} — the LUNARA FILM verdict: ${notes.slice(0, 140)}${notes.length > 140 ? "…" : ""}\n\nFull essay: ${url}`,
    instagramCaption: `🎬 LUNARA FILM REVIEW: ${title.toUpperCase()}\n\n${notes}\n\nRating: ${rating}/5 ${stars}\n\nLink in bio for the full deep dive.`,
    letterboxdReview: `${stars} — "${notes.slice(0, 180)}${notes.length > 180 ? "…" : ""}" — LUNARA FILM Review.`,
    tikTokScript: `Hook: "Why ${title} deserves your next movie night."\nOn-screen text: LUNARA FILM Review — ${rating}/5\nVisual cue: Poster pan + key still frames\nAudio cue: Atmospheric cinematic bass`,
    hashtags: [
      "#LunaraFilm",
      "#MovieReview",
      "#Cinephile",
      "#FilmTwitter",
      `#${title.replace(/[^a-zA-Z0-9]/g, "")}`,
    ],
    engagementScore: 88,
    engagementAdvice: "Post at 6:00 PM local time with a high-contrast still for peak cinephile engagement.",
  };
}

async function generateSocialCopy(params: SocialParams): Promise<{ provider: ProviderName; data: any }> {
  const order = await resolveProviderOrder();
  let lastError: Error | null = null;

  for (const provider of order) {
    try {
      if (provider === "claude") {
        const prompt = `${socialPromptBody(params)}

Respond with ONLY a valid JSON object — no markdown fences, no commentary — with exactly these keys:
{"twitterCopy": string, "instagramCaption": string, "letterboxdReview": string, "tikTokScript": string, "hashtags": string[], "engagementScore": number, "engagementAdvice": string}`;
        const raw = await runClaudeCli(prompt);
        const data = validateKeys(extractJsonObject(raw), SOCIAL_REQUIRED_KEYS);
        return { provider, data };
      }

      if (provider === "gemini") {
        const ai = getGeminiAI();
        if (!ai) throw new Error("GEMINI_API_KEY not configured");
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: socialPromptBody(params),
          config: {
            systemInstruction: "You strictly output clean JSON adhering to the structure requested.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                twitterCopy: { type: Type.STRING },
                instagramCaption: { type: Type.STRING },
                letterboxdReview: { type: Type.STRING },
                tikTokScript: { type: Type.STRING },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                engagementScore: { type: Type.NUMBER },
                engagementAdvice: { type: Type.STRING },
              },
              required: SOCIAL_REQUIRED_KEYS,
            },
          },
        });
        if (!response.text) throw new Error("No response generated from Gemini.");
        return { provider, data: JSON.parse(response.text) };
      }

      return { provider: "template", data: templateSocial(params) };
    } catch (err: any) {
      lastError = err;
      console.warn(`[ai] provider "${provider}" failed: ${err.message} — trying next`);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

// ---------------------------------------------------------------------------
// Copy polishing
// ---------------------------------------------------------------------------

interface PolishParams {
  draftText?: string;
  platform?: string;
  goal?: string;
}

function polishPromptBody(p: PolishParams): string {
  return `Refine and polish this social draft for LUNARA FILM for platform: ${p.platform || "Twitter"}.
Goal: ${p.goal || "Increase engagement and sound authoritative yet passionate about cinema"}.

Draft:
"${p.draftText}"

Provide 3 distinct polished versions:
1. concise: Short, punchy, scroll-stopping.
2. editorial: Deep, analytical, cinephile depth.
3. provocative: High engagement, conversation starter / hot take angle.`;
}

const POLISH_REQUIRED_KEYS = ["concise", "editorial", "provocative"];

function templatePolish(p: PolishParams) {
  const draft = (p.draftText || "").trim();
  return {
    concise: draft.length > 140 ? `${draft.slice(0, 137)}…` : draft,
    editorial: `LUNARA ANALYSIS: ${draft}`,
    provocative: `HOT TAKE: ${draft} — agree, or meet us in the replies?`,
  };
}

async function polishCopy(params: PolishParams): Promise<{ provider: ProviderName; data: any }> {
  const order = await resolveProviderOrder();
  let lastError: Error | null = null;

  for (const provider of order) {
    try {
      if (provider === "claude") {
        const prompt = `${polishPromptBody(params)}

Respond with ONLY a valid JSON object — no markdown fences, no commentary — with exactly these keys:
{"concise": string, "editorial": string, "provocative": string}`;
        const raw = await runClaudeCli(prompt);
        const data = validateKeys(extractJsonObject(raw), POLISH_REQUIRED_KEYS);
        return { provider, data };
      }

      if (provider === "gemini") {
        const ai = getGeminiAI();
        if (!ai) throw new Error("GEMINI_API_KEY not configured");
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: polishPromptBody(params),
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                concise: { type: Type.STRING },
                editorial: { type: Type.STRING },
                provocative: { type: Type.STRING },
              },
              required: POLISH_REQUIRED_KEYS,
            },
          },
        });
        return { provider, data: JSON.parse(response.text || "{}") };
      }

      return { provider: "template", data: templatePolish(params) };
    } catch (err: any) {
      lastError = err;
      console.warn(`[ai] provider "${provider}" failed: ${err.message} — trying next`);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

// ---------------------------------------------------------------------------
// API routes — original /api/gemini/* paths kept for frontend compatibility,
// /api/ai/* aliases added since the backing provider may not be Gemini.
// ---------------------------------------------------------------------------

app.get("/api/health", async (_req, res) => {
  const order = await resolveProviderOrder();
  const sources = wireSources();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    aiProviderOrder: order,
    integrations: {
      claudeCli: order.includes("claude"),
      geminiKey: Boolean(process.env.GEMINI_API_KEY),
      typefullyKey: Boolean(process.env.TYPEFULLY_API_KEY),
      bufferKey: Boolean(process.env.BUFFER_API_KEY),
      tmdbKey: Boolean(process.env.TMDB_API_KEY),
      wordpressSite: process.env.WP_SITE || "lunarafilm.com",
      wordpressWrite: Boolean(process.env.WP_USERNAME && process.env.WP_APP_PASSWORD),
    },
    newsreel: {
      newsFeeds: sources.filter((s) => s.kind === "news").length,
      trailerChannels: sources.filter((s) => s.kind === "trailers").length,
    },
  });
});

app.post(["/api/gemini/generate-social", "/api/ai/generate-social"], async (req, res) => {
  try {
    const { provider, data } = await generateSocialCopy(req.body || {});
    res.json({ success: true, provider, data });
  } catch (error: any) {
    console.error("Error generating social copy:", error);
    res.status(500).json({ error: error.message || "Failed to generate social copy." });
  }
});

app.post(["/api/gemini/polish-copy", "/api/ai/polish-copy"], async (req, res) => {
  try {
    if (!req.body?.draftText) {
      return res.status(400).json({ error: "draftText is required." });
    }
    const { provider, data } = await polishCopy(req.body);
    res.json({ success: true, provider, data });
  } catch (error: any) {
    console.error("Error polishing copy:", error);
    res.status(500).json({ error: error.message || "Failed to polish copy." });
  }
});

// ---------------------------------------------------------------------------
// WordPress journal sync — pulls published posts from your live WordPress.com
// site over its public REST API. Free with the plan you already pay for; no
// credentials required for published content.
// ---------------------------------------------------------------------------

const WP_SITE = process.env.WP_SITE || "lunarafilm.com";
const WP_POST_TYPES = (process.env.WP_POST_TYPES || "review,journal,posts")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&(?:#8217|rsquo|#8216|lsquo);/g, "'")
    .replace(/&(?:#8220|ldquo|#8221|rdquo);/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWpCollection(baseUrl: string, postType: string): Promise<any[]> {
  try {
    const url = `${baseUrl}/${postType}?per_page=20&_embed=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function mapWpPostToJournalEntry(post: any, postType: string) {
  const embedded = post._embedded || {};
  const featuredMedia = embedded["wp:featuredmedia"]?.[0]?.source_url;
  const terms: string[] = Array.from(
    new Set(
      (embedded["wp:term"] || [])
        .flat()
        .map((t: any) => t?.name)
        .filter(Boolean)
    )
  ).slice(0, 6) as string[];
  const excerpt = stripHtml(post.excerpt?.rendered || "");
  const content = stripHtml(post.content?.rendered || "");
  const reviewText = excerpt || content.slice(0, 400);

  return {
    id: `wp-${postType}-${post.id}`,
    title: stripHtml(post.title?.rendered || "Untitled"),
    director: "",
    year: new Date(post.date || Date.now()).getFullYear(),
    posterUrl:
      featuredMedia ||
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop",
    rating: 4.5,
    reviewText,
    tags: terms.length ? terms : ["lunarafilm.com"],
    status: "logged",
    dateWatched: (post.date || "").slice(0, 10),
    articleUrl: post.link,
  };
}

async function fetchWordPressJournal() {
  const bases = [
    // WordPress.com hosted sites (covers lunarafilm.com's existing plan)
    `https://public-api.wordpress.com/wp/v2/sites/${WP_SITE}`,
    // Self-hosted / Jetpack-less fallback
    `https://${WP_SITE}/wp-json/wp/v2`,
  ];

  for (const base of bases) {
    const collections = await Promise.all(
      WP_POST_TYPES.map(async (type) => {
        const posts = await fetchWpCollection(base, type);
        return posts.map((p) => mapWpPostToJournalEntry(p, type));
      })
    );
    const merged = collections.flat();
    if (merged.length > 0) {
      // Dedupe by permalink (the same post can be exposed under multiple types)
      const seen = new Set<string>();
      const unique = merged.filter((e) => {
        const key = e.articleUrl || e.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      unique.sort((a, b) => (b.dateWatched || "").localeCompare(a.dateWatched || ""));
      return unique;
    }
  }
  return [];
}

app.get("/api/wordpress/journal", async (_req, res) => {
  try {
    const entries = await fetchWordPressJournal();
    res.json({ success: true, site: WP_SITE, count: entries.length, entries });
  } catch (error: any) {
    console.error("WordPress sync error:", error);
    res.status(502).json({ error: error.message || `Failed to fetch posts from ${WP_SITE}.` });
  }
});

// ---------------------------------------------------------------------------
// Drafts awaiting review — lists draft posts across the site's post types so
// the dashboard shows what Lunara Dispatch (and Claude) have produced.
// Needs the same WP_USERNAME + WP_APP_PASSWORD as the media pipeline, since
// drafts are only visible to authenticated requests.
// ---------------------------------------------------------------------------

app.get("/api/wordpress/drafts", async (_req, res) => {
  const user = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;
  if (!user || !appPassword) {
    return res.status(503).json({
      error:
        "WP_USERNAME / WP_APP_PASSWORD not set — drafts are private, so listing them needs the Application Password in .env.",
    });
  }

  const auth = "Basic " + Buffer.from(`${user}:${appPassword}`).toString("base64");
  const apiBase = `https://${WP_SITE}/wp-json/wp/v2`;

  try {
    const collections = await Promise.all(
      WP_POST_TYPES.map(async (type) => {
        try {
          const url = `${apiBase}/${type}?status=draft&per_page=20&context=edit&_fields=id,title,modified,link`;
          const r = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" } });
          if (!r.ok) return [];
          const posts = await r.json();
          if (!Array.isArray(posts)) return [];
          return posts.map((p: any) => ({
            id: p.id,
            title: stripHtml(p.title?.rendered || p.title?.raw || "Untitled draft"),
            postType: type,
            modified: p.modified || "",
            editUrl: `https://${WP_SITE}/wp-admin/post.php?post=${p.id}&action=edit&classic-editor`,
            previewUrl: `https://${WP_SITE}/?post_type=${type}&p=${p.id}&preview=true`,
          }));
        } catch {
          return [];
        }
      })
    );
    const drafts = collections.flat().sort((a, b) => (b.modified || "").localeCompare(a.modified || ""));
    res.json({ success: true, count: drafts.length, drafts });
  } catch (error: any) {
    console.error("Drafts listing error:", error);
    res.status(502).json({ error: error.message || `Failed to list drafts from ${WP_SITE}.` });
  }
});

// ---------------------------------------------------------------------------
// Media pipeline — pull official key art / trailer stills from a URL, keep a
// local backup copy in the media vault, upload to the WordPress media
// library, and set it as a post's featured image. Uploading needs
// WP_USERNAME + WP_APP_PASSWORD in .env (create an Application Password in
// wp-admin → Users → Profile → Application Passwords). The vault backup
// happens regardless, so the original asset is never lost.
// ---------------------------------------------------------------------------

const MEDIA_VAULT_DIR = process.env.MEDIA_VAULT_DIR || path.join(process.cwd(), "media-vault");

// An error that already knows which HTTP status the route should answer with.
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Download an image and name it for the vault. Shared by the featured-image
// pipeline and social dispatch (official art attached to Typefully posts).
async function downloadImage(imageUrl: string, filename?: string) {
  const imgRes = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (LUNARA Hub media pipeline)" },
  });
  if (!imgRes.ok) {
    throw new HttpError(502, `Could not download image (HTTP ${imgRes.status}) from ${imageUrl}`);
  }
  const contentType = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new HttpError(400, `URL did not return an image (got ${contentType}).`);
  }
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";
  const baseName = (filename || new URL(imageUrl).pathname.split("/").pop() || "image")
    .replace(/\.(jpe?g|png|webp|gif)$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 80) || "image";
  return { buffer, contentType, ext, baseName };
}

// Every asset that ships gets a local copy in media-vault/YYYY-MM/.
function saveToVault(buffer: Buffer, baseName: string, ext: string): string {
  const vaultDir = path.join(MEDIA_VAULT_DIR, new Date().toISOString().slice(0, 7));
  fs.mkdirSync(vaultDir, { recursive: true });
  const vaultPath = path.join(vaultDir, `${Date.now()}-${baseName}.${ext}`);
  fs.writeFileSync(vaultPath, buffer);
  return vaultPath;
}

app.post("/api/wordpress/featured-image", async (req, res) => {
  const { postId, postType, imageUrl, alt, filename } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required." });
  }

  try {
    const { buffer, contentType, ext, baseName } = await downloadImage(imageUrl, filename);

    // Local backup first — the vault copy survives even if the upload fails.
    const vaultPath = saveToVault(buffer, baseName, ext);

    const user = process.env.WP_USERNAME;
    const appPassword = process.env.WP_APP_PASSWORD;
    if (!user || !appPassword) {
      return res.status(503).json({
        error:
          "WP_USERNAME / WP_APP_PASSWORD not set — the image WAS saved to your local media vault, but not uploaded. Create an Application Password (wp-admin → Users → Profile → Application Passwords) and add both to .env.",
        vaultPath,
      });
    }

    const auth = "Basic " + Buffer.from(`${user}:${appPassword}`).toString("base64");
    const apiBase = `https://${WP_SITE}/wp-json/wp/v2`;

    const uploadRes = await fetch(`${apiBase}/media`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${baseName}.${ext}"`,
      },
      body: buffer,
    });
    const uploadText = await uploadRes.text();
    if (!uploadRes.ok) {
      return res.status(uploadRes.status).json({
        error: `WordPress media upload failed (${uploadRes.status}): ${uploadText.slice(0, 300)}`,
        vaultPath,
      });
    }
    const media = JSON.parse(uploadText);

    if (alt) {
      await fetch(`${apiBase}/media/${media.id}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: alt }),
      }).catch(() => {});
    }

    let featuredSet = false;
    if (postId) {
      // CPTs like "journal" and "review" use their slug as the REST base.
      const restBase = postType || "posts";
      const postRes = await fetch(`${apiBase}/${restBase}/${postId}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ featured_media: media.id }),
      });
      if (!postRes.ok) {
        const t = await postRes.text();
        return res.status(postRes.status).json({
          error: `Media uploaded (ID ${media.id}) but setting the featured image failed: ${t.slice(0, 300)}`,
          mediaId: media.id,
          mediaUrl: media.source_url,
          vaultPath,
        });
      }
      featuredSet = true;
    }

    res.json({
      success: true,
      mediaId: media.id,
      mediaUrl: media.source_url,
      featuredSet,
      postId: postId || null,
      vaultPath,
    });
  } catch (error: any) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("Featured image pipeline error:", error);
    res.status(500).json({ error: error.message || "Featured image pipeline failed." });
  }
});

// ---------------------------------------------------------------------------
// Typefully dispatch — sends copy straight into your Typefully drafts (or the
// next free queue slot). API v2 — v1 was switched off on 15 June 2026, and v1
// keys don't work with v2. Free with an existing Typefully account:
// Typefully → Settings → API. Drafts go to every connected platform in the
// social set unless TYPEFULLY_PLATFORMS narrows it.
// ---------------------------------------------------------------------------

const TYPEFULLY_API = "https://api.typefully.com/v2";
const TYPEFULLY_POSTABLE = ["x", "threads", "bluesky", "linkedin", "mastodon"];

async function typefullyFetch(pathname: string, init: RequestInit = {}) {
  const response = await fetch(`${TYPEFULLY_API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.TYPEFULLY_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail = data?.error?.message || data?.detail || text.slice(0, 300);
    const hint =
      response.status === 401 || response.status === 403
        ? " — if this key predates API v2, create a new one in Typefully → Settings → API."
        : "";
    throw new HttpError(response.status, `Typefully API error (${response.status}): ${detail}${hint}`);
  }
  return data;
}

interface TypefullyTarget {
  socialSetId: string;
  label: string;
  platforms: string[];
}

let typefullyTarget: { at: number; value: TypefullyTarget } | null = null;

// Which social set to post into, and which of its platforms are connected.
async function resolveTypefullyTarget(): Promise<TypefullyTarget> {
  if (typefullyTarget && Date.now() - typefullyTarget.at < 10 * 60 * 1000) {
    return typefullyTarget.value;
  }
  let socialSetId = (process.env.TYPEFULLY_SOCIAL_SET_ID || "").trim();
  if (!socialSetId) {
    const list = await typefullyFetch("/social-sets?limit=10");
    const first = list?.results?.[0];
    if (!first) throw new HttpError(404, "Typefully key works, but the account has no social sets yet.");
    socialSetId = String(first.id);
  }
  const details = await typefullyFetch(`/social-sets/${encodeURIComponent(socialSetId)}`);
  const connected = TYPEFULLY_POSTABLE.filter((p) => details?.platforms?.[p]);
  const wanted = (process.env.TYPEFULLY_PLATFORMS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const platforms = wanted.length ? connected.filter((p) => wanted.includes(p)) : connected;
  if (!platforms.length) {
    throw new HttpError(
      409,
      `Typefully social set ${socialSetId} has no connected platforms${wanted.length ? ` matching TYPEFULLY_PLATFORMS (${wanted.join(", ")})` : ""}.`
    );
  }
  const value = {
    socialSetId,
    label: details?.name || details?.username || `Social set ${socialSetId}`,
    platforms,
  };
  typefullyTarget = { at: Date.now(), value };
  return value;
}

// Official art → vault backup → Typefully media library (presigned upload).
async function typefullyUploadImage(socialSetId: string, imageUrl: string, alt?: string) {
  const { buffer, ext, baseName } = await downloadImage(imageUrl);
  const vaultPath = saveToVault(buffer, baseName, ext);
  const upload = await typefullyFetch(`/social-sets/${encodeURIComponent(socialSetId)}/media/upload`, {
    method: "POST",
    body: JSON.stringify({ file_name: `${baseName}.${ext}`, ...(alt ? { alt_text: alt } : {}) }),
  });
  // Typefully's docs: raw bytes only, no extra headers, or the signature breaks.
  const put = await fetch(upload.upload_url, { method: "PUT", body: buffer });
  if (!put.ok) throw new Error(`Typefully media upload failed (HTTP ${put.status})`);
  for (let i = 0; i < 15; i++) {
    const status = await typefullyFetch(`/social-sets/${encodeURIComponent(socialSetId)}/media/${upload.media_id}`);
    if (status?.status === "ready") return { mediaId: String(upload.media_id), vaultPath };
    if (status?.status === "failed") throw new Error(`Typefully couldn't process the image: ${status.error_reason || "unknown"}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Typefully is still processing the image — sent without it.");
}

app.get("/api/typefully/status", async (_req, res) => {
  if (!process.env.TYPEFULLY_API_KEY) {
    return res.status(503).json({ error: "TYPEFULLY_API_KEY is not set." });
  }
  try {
    const target = await resolveTypefullyTarget();
    res.json({ success: true, ...target });
  } catch (error: any) {
    res.status(error instanceof HttpError ? error.status : 502).json({ error: error.message });
  }
});

app.post("/api/typefully/draft", async (req, res) => {
  if (!process.env.TYPEFULLY_API_KEY) {
    return res.status(503).json({
      error:
        "TYPEFULLY_API_KEY is not set. Grab a free key from Typefully → Settings → API and add it to .env.",
    });
  }

  const { content, scheduleToNextSlot, threadify, imageUrl, imageAlt, title, platforms: onlyPlatforms } =
    req.body || {};
  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "content is required." });
  }

  try {
    const target = await resolveTypefullyTarget();
    const platforms = Array.isArray(onlyPlatforms) && onlyPlatforms.length
      ? target.platforms.filter((p) => onlyPlatforms.includes(p))
      : target.platforms;
    if (!platforms.length) {
      return res.status(400).json({ error: `None of those platforms are connected in ${target.label}.` });
    }

    let mediaIds: string[] = [];
    let mediaNote: string | null = null;
    let vaultPath: string | null = null;
    if (imageUrl) {
      try {
        const media = await typefullyUploadImage(target.socialSetId, imageUrl, imageAlt);
        mediaIds = [media.mediaId];
        vaultPath = media.vaultPath;
      } catch (err: any) {
        mediaNote = err.message;
      }
    }

    // Four newlines split a thread — the same convention Typefully's editor uses.
    const parts = threadify
      ? content.split(/\n{4,}/).map((s: string) => s.trim()).filter(Boolean)
      : [content.trim()];
    const posts = parts.map((text: string, i: number) => ({
      text,
      ...(i === 0 && mediaIds.length ? { media_ids: mediaIds } : {}),
    }));
    const platformBody = Object.fromEntries(
      platforms.map((p) => [
        p,
        {
          enabled: true,
          // LinkedIn has no threads — it gets the whole thing as one post.
          posts: p === "linkedin" && posts.length > 1
            ? [{ text: parts.join("\n\n"), ...(mediaIds.length ? { media_ids: mediaIds } : {}) }]
            : posts,
        },
      ])
    );

    const draft = await typefullyFetch(`/social-sets/${encodeURIComponent(target.socialSetId)}/drafts`, {
      method: "POST",
      body: JSON.stringify({
        platforms: platformBody,
        ...(title ? { draft_title: String(title).slice(0, 120) } : {}),
        ...(scheduleToNextSlot ? { publish_at: "next-free-slot" } : {}),
      }),
    });
    res.json({
      success: true,
      draft,
      socialSet: target.label,
      platforms,
      mediaAttached: mediaIds.length > 0,
      mediaNote,
      vaultPath,
    });
  } catch (error: any) {
    console.error("Typefully dispatch error:", error.message);
    res
      .status(error instanceof HttpError ? error.status : 502)
      .json({ error: error.message || "Failed to reach the Typefully API." });
  }
});

// ---------------------------------------------------------------------------
// Buffer dispatch — Buffer's GraphQL API (public beta), available on every
// plan including Free. Personal key: Buffer → Settings → API. Posts go to the
// channel queue (or "share next" / drafts); nothing is ever published
// instantly from the hub.
// ---------------------------------------------------------------------------

const BUFFER_API = "https://api.buffer.com";
// Services where a text + link post works. Instagram/TikTok/YouTube/Pinterest
// need media-specific metadata — schedule those in Buffer itself.
const BUFFER_TEXT_SERVICES = ["twitter", "threads", "bluesky", "mastodon", "linkedin", "facebook"];

async function bufferGraphql(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(BUFFER_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BUFFER_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const json: any = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(response.status, "Buffer rejected the API key — create a new one in Buffer → Settings → API.");
  }
  if (!response.ok || !json) {
    throw new HttpError(502, `Buffer API error (HTTP ${response.status})`);
  }
  // GraphQL answers 200 even for failures; system errors live in `errors`.
  if (json.errors?.length) {
    throw new HttpError(502, `Buffer API error: ${json.errors.map((e: any) => e.message).join("; ")}`);
  }
  return json.data;
}

let bufferChannelsCache: { at: number; channels: any[] } | null = null;

async function listBufferChannels(force = false) {
  if (!force && bufferChannelsCache && Date.now() - bufferChannelsCache.at < 10 * 60 * 1000) {
    return bufferChannelsCache.channels;
  }
  const orgs = await bufferGraphql(`query LunaraOrganizations { account { organizations { id name } } }`);
  const channels: any[] = [];
  for (const org of orgs?.account?.organizations || []) {
    const data = await bufferGraphql(
      `query LunaraChannels($organizationId: OrganizationId!) {
        channels(input: { organizationId: $organizationId }) {
          id name displayName service avatar isQueuePaused isDisconnected isLocked
        }
      }`,
      { organizationId: org.id }
    );
    for (const c of data?.channels || []) {
      channels.push({
        id: c.id,
        name: c.displayName || c.name,
        handle: c.name,
        service: c.service,
        avatar: c.avatar,
        organization: org.name,
        queuePaused: Boolean(c.isQueuePaused),
        usable: BUFFER_TEXT_SERVICES.includes(String(c.service).toLowerCase()) && !c.isDisconnected && !c.isLocked,
      });
    }
  }
  bufferChannelsCache = { at: Date.now(), channels };
  return channels;
}

app.get("/api/buffer/channels", async (req, res) => {
  if (!process.env.BUFFER_API_KEY) {
    return res.status(503).json({ error: "BUFFER_API_KEY is not set. Create one in Buffer → Settings → API and add it to .env." });
  }
  try {
    const channels = await listBufferChannels(req.query.refresh === "1");
    const preferred = (process.env.BUFFER_CHANNEL_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    res.json({
      success: true,
      channels,
      defaultChannelIds: preferred.length
        ? preferred
        : channels.filter((c) => c.usable && !c.queuePaused).map((c) => c.id),
    });
  } catch (error: any) {
    res.status(error instanceof HttpError ? error.status : 502).json({ error: error.message });
  }
});

app.post("/api/buffer/post", async (req, res) => {
  if (!process.env.BUFFER_API_KEY) {
    return res.status(503).json({ error: "BUFFER_API_KEY is not set. Create one in Buffer → Settings → API and add it to .env." });
  }
  const { text, channelIds, mode = "queue", imageUrl, aiAssisted } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required." });
  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    return res.status(400).json({ error: "Pick at least one Buffer channel." });
  }
  const shareMode = mode === "next" ? "shareNext" : "addToQueue";

  const mutation = `mutation LunaraCreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id dueAt } }
      ... on MutationError { message }
    }
  }`;

  try {
    // Buffer fetches the image itself when the post goes out, so no upload —
    // but the vault still keeps a copy of every asset that ships.
    let vaultPath: string | null = null;
    if (imageUrl) {
      try {
        const { buffer, ext, baseName } = await downloadImage(imageUrl);
        vaultPath = saveToVault(buffer, baseName, ext);
      } catch {
        // the vault copy is a courtesy here; Buffer still gets the URL
      }
    }

    const results = await Promise.all(
      channelIds.map(async (channelId: string) => {
        try {
          const data = await bufferGraphql(mutation, {
            input: {
              text,
              channelId,
              schedulingType: "automatic",
              mode: shareMode,
              ...(mode === "draft" ? { saveToDraft: true } : {}),
              assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
              aiAssisted: Boolean(aiAssisted),
            },
          });
          const result = data?.createPost;
          if (result?.post) return { channelId, ok: true, postId: result.post.id, dueAt: result.post.dueAt || null };
          return { channelId, ok: false, error: result?.message || "Buffer did not accept the post." };
        } catch (err: any) {
          return { channelId, ok: false, error: err.message };
        }
      })
    );
    const okCount = results.filter((r) => r.ok).length;
    res.status(okCount ? 200 : 502).json({
      success: okCount > 0,
      mode,
      results,
      vaultPath,
      ...(okCount ? {} : { error: results.map((r) => r.error).filter(Boolean).join(" · ") }),
    });
  } catch (error: any) {
    res.status(error instanceof HttpError ? error.status : 502).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Newsreel — the movie news wire behind the hub's swipeable deck. All $0:
//   · trade RSS — the roster Lunara Dispatch watches, plus THR
//   · official studio YouTube channels (public Atom feeds, no key) for
//     trailer drops, with the trailer's own still as the card image
//   · TMDB (free key, TMDB_API_KEY) for official key art and official trailers
// Read-only by design: the wire feeds the deck and social dispatch, and never
// writes site drafts — Dispatch stays the sole site intake
// (PUBLISHING-PLAYBOOK.md → Automation architecture).
// ---------------------------------------------------------------------------

type WireKind = "news" | "trailers";
type NewsCategory = "trailers" | "casting" | "boxoffice" | "awards" | "streaming" | "reviews" | "news";

interface WireSource {
  id: string;
  label: string;
  url: string;
  kind: WireKind;
}

interface WireImage {
  url: string;
  credit: string;
  // true for studio key art / official trailer stills — the only images the
  // hub will attach to social posts. Outlet photos stay display-only.
  official: boolean;
}

interface WireFilm {
  tmdbId: number;
  title: string;
  year?: string;
  releaseDate?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  studio?: string;
  tmdbUrl: string;
}

interface WireTrailer {
  youtubeId: string;
  url: string;
  name: string;
  credit: string;
}

interface WireStory {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceId: string;
  kind: WireKind;
  category: NewsCategory;
  publishedAt: string | null;
  summary: string;
  author?: string;
  image?: WireImage;
  film?: WireFilm;
  trailer?: WireTrailer;
  // internal: title candidates for the TMDB lookup
  candidates: string[];
}

interface WireSourceStatus {
  id: string;
  label: string;
  kind: WireKind;
  ok: boolean;
  count: number;
  error?: string;
}

const DEFAULT_NEWS_FEEDS: WireSource[] = [
  { id: "deadline", label: "Deadline", url: "https://deadline.com/v/film/feed/", kind: "news" },
  { id: "variety", label: "Variety", url: "https://variety.com/v/film/feed/", kind: "news" },
  { id: "thr", label: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/c/movies/feed/", kind: "news" },
  { id: "indiewire", label: "IndieWire", url: "https://www.indiewire.com/feed/", kind: "news" },
  { id: "world-of-reel", label: "World of Reel", url: "https://www.worldofreel.com/blog?format=rss", kind: "news" },
  {
    id: "ew-movies",
    label: "Entertainment Weekly",
    url: "https://feeds-api.dotdashmeredith.com/v1/rss/google/defadcea-6edf-45ce-88f1-eabd71a81843",
    kind: "news",
  },
  { id: "film-stage", label: "The Film Stage", url: "https://thefilmstage.com/feed/", kind: "news" },
  { id: "the-playlist", label: "The Playlist", url: "https://theplaylist.net/feed/", kind: "news" },
  {
    id: "screen-daily",
    label: "Screen Daily",
    url: "https://www.screendaily.com/XmlServers/navsectionRSS.aspx?navsectioncode=4523",
    kind: "news",
  },
];

// Official studio channels, verified against each channel's own feed title.
const DEFAULT_TRAILER_CHANNELS: Array<[string, string]> = [
  ["UCjmJDM5pRKbUlVIzDYYWb6g", "Warner Bros."],
  ["UCq0OueAsdxH6b8nyAspwViw", "Universal Pictures"],
  ["UCz97F7dMxBNOfGYu3rx8aCw", "Sony Pictures"],
  ["UCF9imwPMSGz4Vq1NiTWCC7g", "Paramount Pictures"],
  ["UC_5niPa-d35gg88HaS7RrIw", "Disney"],
  ["UCvC4D8onUfXzvjTOM-dBfEA", "Marvel Entertainment"],
  ["UC_IRYSp4auq7hKLvziWVH6w", "Pixar"],
  ["UC2-BeLxzUBSs0uSrmzWhJuQ", "20th Century Studios"],
  ["UCor9rW6PgxSQ9vUPWQdnaYQ", "Searchlight Pictures"],
  ["UCU4SM3j_9TNWaSu8KdGV50g", "Focus Features"],
  ["UCJ6nMHaJPZvsJ-HmUmj1SeA", "Lionsgate Movies"],
  ["UCf5CjDJvsFvtVIhkfmKAwAA", "Amazon MGM Studios"],
  ["UCuPivVjnfNo4mb3Oog_frZg", "A24"],
  ["UCpy5dRhZd-JbZP4NsrnLt1w", "NEON"],
  ["UCb6-VM5UQ4Czj_d3m9EPGfg", "MUBI"],
  ["UCWOA1ZGywLbqmigxE4Qlvuw", "Netflix"],
  ["UC1Myj674wRVXB9I4c6Hm5zA", "Apple TV"],
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "source";

// NEWS_FEEDS / NEWS_TRAILER_CHANNELS replace the defaults: comma-separated,
// each entry either "url" / "channelId" or "Label|url" / "Label|channelId".
function parseSourceList(raw: string | undefined, kind: WireKind): WireSource[] | null {
  if (!raw || !raw.trim()) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, value] = entry.includes("|") ? entry.split("|").map((s) => s.trim()) : ["", entry];
      const url =
        kind === "trailers" && !/^https?:/i.test(value)
          ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(value)}`
          : value;
      return { id: slugify(label || value), label, url, kind };
    });
}

function wireSources(): WireSource[] {
  const news = parseSourceList(process.env.NEWS_FEEDS, "news") || DEFAULT_NEWS_FEEDS;
  const trailers =
    parseSourceList(process.env.NEWS_TRAILER_CHANNELS, "trailers") ||
    DEFAULT_TRAILER_CHANNELS.map(([channelId, label]) => ({
      id: slugify(label),
      label,
      url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      kind: "trailers" as const,
    }));
  return [...news, ...trailers];
}

// --- Minimal RSS 2.0 / Atom reader (no dependency) -------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", mdash: "—", ndash: "–",
  eacute: "é", egrave: "è", aacute: "á", agrave: "à", oacute: "ó", iacute: "í", uacute: "ú",
  ntilde: "ñ", ouml: "ö", uuml: "ü", auml: "ä", ccedil: "ç", copy: "©", reg: "®", trade: "™",
  middot: "·", bull: "•", laquo: "«", raquo: "»", prime: "′", times: "×",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const cleanText = (html: string) =>
  decodeEntities((html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? "");
  }
  return attrs;
}

interface FeedEntry {
  title: string;
  link: string;
  published: string;
  descriptionHtml: string;
  contentHtml: string;
  categories: string[];
  author: string;
  images: string[];
  youtubeId?: string;
}

const JUNK_IMAGE = /logo|avatar|gravatar|favicon|[-_/]icon[-_.]|pixel|spacer|feedburner|badge|1x1|placeholder|lockup|\.gif(\?|$)/i;

// Best image candidates from inline HTML: prefer full-size data-image, then
// the widest srcset entry, then src.
function imagesFromHtml(html: string): string[] {
  const out: string[] = [];
  for (const m of (html || "").matchAll(/<img\b[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    const srcset = (a.srcset || "")
      .split(",")
      .map((part) => part.trim().split(/\s+/))
      .filter((p) => p[0])
      .sort((x, y) => (parseInt(y[1] || "0", 10) || 0) - (parseInt(x[1] || "0", 10) || 0));
    const pick = a["data-image"] || srcset[0]?.[0] || a["data-src"] || a.src;
    if (pick) out.push(pick);
  }
  return out;
}

function parseFeed(xml: string): { title: string; entries: FeedEntry[] } {
  // Park CDATA blocks so HTML inside them can't confuse the tag scans below.
  const cdata: string[] = [];
  const masked = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, inner) => `\u0000${cdata.push(inner) - 1}\u0000`);
  const valueOf = (inner: string | null) =>
    (inner || "")
      .split(/(\u0000\d+\u0000)/)
      .map((seg) => {
        const m = seg.match(/^\u0000(\d+)\u0000$/);
        return m ? cdata[Number(m[1])] ?? "" : decodeEntities(seg);
      })
      .join("");
  const firstTag = (block: string, tag: string) =>
    block.match(new RegExp(`<${escapeRegex(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegex(tag)}>`, "i"))?.[1] ?? null;
  const allTags = (block: string, tag: string) =>
    [...block.matchAll(new RegExp(`<${escapeRegex(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegex(tag)}>`, "gi"))].map(
      (m) => m[1]
    );
  const tagAttrs = (block: string, tag: string) =>
    [...block.matchAll(new RegExp(`<${escapeRegex(tag)}(?=[\\s/>])([^>]*)>`, "gi"))].map((m) => parseAttrs(m[1]));

  const blocks = [...masked.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  const head = blocks.length ? masked.slice(0, blocks[0].index) : masked;
  const feedTitle = cleanText(valueOf(firstTag(head, "title")));

  const entries = blocks.map((m) => {
    const b = m[2];
    let link = valueOf(firstTag(b, "link")).trim();
    if (!link) {
      const links = tagAttrs(b, "link");
      link = (links.find((l) => !l.rel || l.rel === "alternate") || links[0])?.href || "";
    }
    const descriptionHtml = valueOf(
      firstTag(b, "description") ?? firstTag(b, "summary") ?? firstTag(b, "media:description")
    );
    const contentHtml = valueOf(firstTag(b, "content:encoded") ?? firstTag(b, "content"));
    const authorBlock = firstTag(b, "dc:creator") ?? firstTag(b, "author") ?? "";
    const images: string[] = [];
    for (const a of tagAttrs(b, "media:content")) {
      if (a.url && (a.medium === "image" || (a.type || "").startsWith("image/") || /\.(jpe?g|png|webp)(\?|$)/i.test(a.url))) {
        images.push(a.url);
      }
    }
    for (const a of tagAttrs(b, "media:thumbnail")) if (a.url) images.push(a.url);
    for (const a of tagAttrs(b, "enclosure")) if (a.url && (a.type || "").startsWith("image/")) images.push(a.url);
    images.push(...imagesFromHtml(descriptionHtml), ...imagesFromHtml(contentHtml));

    return {
      title: cleanText(valueOf(firstTag(b, "title"))),
      link: link.trim(),
      published: cleanText(
        valueOf(firstTag(b, "pubDate") ?? firstTag(b, "published") ?? firstTag(b, "dc:date") ?? firstTag(b, "updated"))
      ),
      descriptionHtml,
      contentHtml,
      categories: [
        ...allTags(b, "category").map((c) => cleanText(valueOf(c))),
        ...tagAttrs(b, "category").map((a) => a.term || ""),
      ].filter(Boolean),
      author: cleanText(valueOf(firstTag(authorBlock, "name") ?? authorBlock)),
      images: images.filter((u) => /^https?:\/\//i.test(u) && !JUNK_IMAGE.test(u)),
      youtubeId: cleanText(valueOf(firstTag(b, "yt:videoId"))) || undefined,
    };
  });

  return { title: feedTitle, entries };
}

// --- Story shaping ----------------------------------------------------------

function summarize(html: string): string {
  let t = cleanText(html)
    .replace(/\[(?:…|\.\.\.)\]/g, "…")
    .replace(/^Note: This review was originally published[^.]*\.\s*/i, "")
    .replace(/The post .{0,300}? (?:first )?appeared (?:first )?on .{0,120}?\.?\s*$/i, "")
    .replace(/\s*(?:Continue reading|Read more)\b.*$/i, "")
    .replace(/https?:\/\/\S+/g, "")
    // channel boilerplate in studio trailer descriptions
    .replace(/[^.!?:]*\b(?:subscribe|follow us|like us on)\b[^.!?:]*[.!?:]?/gi, " ")
    .replace(/(?:^|\s)#\w+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 320) {
    const cut = t.slice(0, 320);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = stop > 120 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
  }
  return t;
}

const CATEGORY_RULES: Array<[NewsCategory, RegExp]> = [
  ["trailers", /\b(trailer|teaser|first look|sneak peek)\b/],
  ["boxoffice", /\bbox office\b|\bopening weekend\b|\bgross(es|ed)?\b|\bticket sales\b/],
  ["reviews", /\breviews?\b|\bcritic'?s pick\b/],
  [
    "awards",
    /\boscars?\b|\bacademy awards?\b|\bawards?\b|\bgolden globes?\b|\bbafta\b|\bfestival\b|\bfest\b|\bvenice\b|\bcannes\b|\btiff\b|\btelluride\b|\bsundance\b|\bberlinale\b|\bnyff\b/,
  ],
  [
    "casting",
    /\bcast(s|ing)?\b|\bjoins?\b|\bto star\b|\bin talks\b|\bboards\b|\btapped\b|\bto direct\b|\bto helm\b|\battached\b|\blands? .{0,24}\brole\b/,
  ],
  [
    "streaming",
    /\bnetflix\b|\bhulu\b|\bdisney\+|\bprime video\b|\bapple tv\b|\bpeacock\b|\bparamount\+|\bmubi\b|\bstreaming\b|\bhbo max\b/,
  ],
];

function categorize(kind: WireKind, title: string, categories: string[]): NewsCategory {
  if (kind === "trailers") return "trailers";
  const t = title.toLowerCase();
  const c = categories.join(" · ").toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(t)) return cat;
  for (const [cat, re] of CATEGORY_RULES) if (re.test(c)) return cat;
  return "news";
}

const FILM_CONTEXT = /^\s*(?:’s|'s)?\s*(trailer|teaser|review|sequel|prequel|remake|reboot|director|star|stars|cast|images?|footage|set|first|box office|opening|release|premiere|poster|clip|writer|producer|team|actor|actress|franchise|script|shoot|spinoff)\b/i;

// Likely film titles in a headline: quoted phrases ('Narnia', “The Odyssey”),
// "X Review:" leads, YouTube "Title | Official Trailer", and <i>Title</i> in
// the outlet's own markup. Each gets verified against TMDB before use.
function filmCandidates(kind: WireKind, title: string, descriptionHtml: string): string[] {
  const found: Array<{ text: string; after: string }> = [];
  const patterns = [
    /“([^”]{2,80})”/g,
    /"([^"]{2,80})"/g,
    /(?:^|[\s(\[—–-])‘(.{2,80}?)[’'](?=$|[\s,.:;!?)\]—–-]|’s|'s)/g,
    /(?:^|[\s(\[—–-])'(.{2,80}?)['’](?=$|[\s,.:;!?)\]—–-]|’s|'s)/g,
  ];
  for (const re of patterns) {
    for (const m of title.matchAll(re)) {
      const end = (m.index ?? 0) + m[0].length;
      found.push({ text: m[1], after: title.slice(end) });
    }
  }
  // The Film Stage style: "Primetime Review: A Thrilling Indictment"
  const lead = title.match(/^(.{2,60}?)\s+Review:/);
  if (lead && !/[‘’“”"'|–—:]/.test(lead[1])) found.push({ text: lead[1], after: "review" });
  if (kind === "trailers") {
    const head = title
      .split(/\s+[|–—]\s+|\s+-\s+/)[0]
      .replace(/\b(official|final|new)?\s*(trailer|teaser)\b.*$/i, "")
      .replace(/\(\d{4}\)/g, "");
    if (head.trim()) found.push({ text: head, after: "trailer" });
  }
  for (const m of (descriptionHtml || "").matchAll(/<(?:i|em)>([^<]{2,60})<\/(?:i|em)>/gi)) {
    found.push({ text: decodeEntities(m[1]), after: "review" });
  }

  const out: string[] = [];
  for (const { text, after } of found) {
    const t = text.replace(/\s+/g, " ").replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "").trim();
    const words = t.split(" ").length;
    if (!t || words > 8 || !/^[A-Z0-9]/.test(t)) continue;
    // A lone quoted word is often a pull quote ("Haters") — only trust it when
    // the headline treats it like a film ("'Narnia' Images", "'Sinners' Director").
    if (words === 1 && !FILM_CONTEXT.test(after) && kind !== "trailers") continue;
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 3);
}

const normTitle = (s: string) =>
  (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the /, "")
    .trim();

function storyId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 14);
}

const TRAILER_TITLE = /\b(trailer|teaser)\b/i;
// Studio channels also post shorts, TV and "teaser tomorrow" promos — skip them.
const NOT_A_FILM_TRAILER =
  /\bseason\s*\d+|\bseries\b|\bepisode\b|\bS\d{1,2}\b|\breaction\b|\bbreakdown\b|\brecap\b|\btomorrow\b|#[a-z]/i;
// LUNARA is a film journal: drop the obvious TV stories the trades mix in.
const TV_STORY =
  /\bseason\s*\d+\b|\bS\d{1,2}\b|\b(?:tv|television) (?:series|adaptation|show|drama|comedy)\b|\b(?:miniseries|limited series|docuseries|series adaptation|showrunner|sitcom|renewed for)\b|\bemmys?\b/i;
const NEWS_MAX_AGE_MS = 4 * 24 * 3600 * 1000;
const TRAILER_MAX_AGE_MS = 21 * 24 * 3600 * 1000;

function toStories(feed: { title: string; entries: FeedEntry[] }, src: WireSource, label: string): WireStory[] {
  const now = Date.now();
  const stories: WireStory[] = [];
  for (const e of feed.entries) {
    if (!e.title || !e.link) continue;
    const ms = Date.parse(e.published);
    const publishedAt = Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    const age = Number.isFinite(ms) ? now - ms : 0;

    if (src.kind === "trailers") {
      if (!e.youtubeId || !TRAILER_TITLE.test(e.title) || NOT_A_FILM_TRAILER.test(e.title)) continue;
      if (age > TRAILER_MAX_AGE_MS) continue;
      if (stories.some((s) => normTitle(s.title) === normTitle(e.title))) continue; // re-uploads
      const watchUrl = `https://www.youtube.com/watch?v=${e.youtubeId}`;
      stories.push({
        id: storyId(watchUrl),
        title: e.title,
        url: watchUrl,
        source: label,
        sourceId: src.id,
        kind: "trailers",
        category: "trailers",
        publishedAt,
        summary: summarize(e.descriptionHtml),
        image: { url: `https://i.ytimg.com/vi/${e.youtubeId}/hqdefault.jpg`, credit: label, official: true },
        trailer: { youtubeId: e.youtubeId, url: watchUrl, name: e.title, credit: label },
        candidates: filmCandidates("trailers", e.title, ""),
      });
      if (stories.length >= 4) break;
      continue;
    }

    if (age > NEWS_MAX_AGE_MS || TV_STORY.test(e.title)) continue;
    const imageUrl = e.images[0];
    stories.push({
      id: storyId(e.link),
      title: e.title,
      url: e.link,
      source: label,
      sourceId: src.id,
      kind: "news",
      category: categorize("news", e.title, e.categories),
      publishedAt,
      summary: summarize(e.descriptionHtml || e.contentHtml),
      author: e.author || undefined,
      image: imageUrl ? { url: imageUrl, credit: label, official: false } : undefined,
      candidates: filmCandidates("news", e.title, e.descriptionHtml),
    });
    if (stories.length >= 15) break;
  }
  return stories;
}

const WIRE_UA = "Mozilla/5.0 (compatible; LUNARA-Hub/1.0; +https://lunarafilm.com)";

async function fetchFeedText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": WIRE_UA, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 5000))) {
    throw new Error(/<html/i.test(text.slice(0, 2000)) ? "returned a web page, not a feed (bot wall?)" : "not an RSS/Atom feed");
  }
  return text;
}

async function buildWire(): Promise<{ stories: WireStory[]; sources: WireSourceStatus[] }> {
  const results = await Promise.all(
    wireSources().map(async (src) => {
      try {
        const feed = parseFeed(await fetchFeedText(src.url));
        const label = src.label || feed.title || new URL(src.url).hostname.replace(/^www\./, "");
        const stories = toStories(feed, { ...src, id: src.id || slugify(label) }, label);
        return { status: { id: src.id, label, kind: src.kind, ok: true, count: stories.length }, stories };
      } catch (err: any) {
        const label = src.label || new URL(src.url).hostname.replace(/^www\./, "");
        return {
          status: { id: src.id, label, kind: src.kind, ok: false, count: 0, error: err?.message || "unreachable" },
          stories: [] as WireStory[],
        };
      }
    })
  );
  const seen = new Set<string>();
  const stories = results
    .flatMap((r) => r.stories)
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 150);
  return { stories, sources: results.map((r) => r.status) };
}

// --- Enrichment: official art + trailers ------------------------------------

const TMDB_IMG = "https://image.tmdb.org/t/p";

async function tmdbGet(pathname: string, params: Record<string, string> = {}): Promise<any> {
  const key = process.env.TMDB_API_KEY || "";
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // v4 "API Read Access Tokens" are JWTs; v3 keys go in the query string.
  const bearer = key.startsWith("eyJ");
  if (!bearer) url.searchParams.set("api_key", key);
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(bearer ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
  return response.json();
}

interface FilmMatch extends WireFilm {
  trailerKey?: string;
  trailerName?: string;
}

async function lookupFilm(candidate: string): Promise<FilmMatch | null> {
  const search = await tmdbGet("/search/movie", { query: candidate, include_adult: "false", language: "en-US" });
  const results: any[] = (search?.results || []).slice(0, 10);
  const want = normTitle(candidate);
  const thisYear = new Date().getFullYear();
  const yearOf = (r: any) => Number(String(r.release_date || "").slice(0, 4)) || null;
  const recent = (r: any) => {
    const y = yearOf(r);
    return y === null || (y >= thisYear - 4 && y <= thisYear + 5);
  };
  const byHeat = (a: any, b: any) => Number(recent(b)) - Number(recent(a)) || (b.popularity || 0) - (a.popularity || 0);
  const exact = results.filter((r) => normTitle(r.title) === want || normTitle(r.original_title) === want).sort(byHeat);
  // "'Narnia' Images" → "Narnia: The Magician's Nephew", but only for current titles.
  const subtitled = results
    .filter((r) => recent(r) && new RegExp(`^${escapeRegex(candidate)}\\s*:`, "i").test(r.title || ""))
    .sort(byHeat);
  const pick = exact[0] || subtitled[0];
  if (!pick) return null;

  const d = await tmdbGet(`/movie/${pick.id}`, { append_to_response: "videos", language: "en-US" });
  const official = (d?.videos?.results || [])
    .filter((v: any) => v.site === "YouTube" && v.official && (v.type === "Trailer" || v.type === "Teaser"))
    .sort(
      (a: any, b: any) =>
        (a.type === "Trailer" ? 0 : 1) - (b.type === "Trailer" ? 0 : 1) ||
        String(b.published_at || "").localeCompare(String(a.published_at || ""))
    );
  return {
    tmdbId: d.id,
    title: d.title,
    year: String(d.release_date || "").slice(0, 4) || undefined,
    releaseDate: d.release_date || undefined,
    overview: d.overview || undefined,
    poster: d.poster_path ? `${TMDB_IMG}/w780${d.poster_path}` : undefined,
    backdrop: d.backdrop_path ? `${TMDB_IMG}/w1280${d.backdrop_path}` : undefined,
    studio: d.production_companies?.[0]?.name || undefined,
    tmdbUrl: `https://www.themoviedb.org/movie/${d.id}`,
    trailerKey: official[0]?.key,
    trailerName: official[0]?.name,
  };
}

// Many stories name the same film — look each title up once.
const filmMatchCache = new Map<string, Promise<FilmMatch | null>>();

async function matchFilm(candidates: string[]): Promise<FilmMatch | null> {
  for (const candidate of candidates) {
    const key = normTitle(candidate);
    if (!key) continue;
    if (!filmMatchCache.has(key)) {
      if (filmMatchCache.size > 1000) filmMatchCache.delete(filmMatchCache.keys().next().value as string);
      filmMatchCache.set(
        key,
        lookupFilm(candidate).catch(() => {
          filmMatchCache.delete(key); // network blip — retry next pass
          return null;
        })
      );
    }
    const hit = await filmMatchCache.get(key);
    if (hit) return hit;
  }
  return null;
}

// The verified channel name behind a YouTube video (the playbook's
// official-channel check), used as the trailer credit.
const oembedCache = new Map<string, Promise<string | null>>();
function youtubeChannelName(videoId: string): Promise<string | null> {
  if (!oembedCache.has(videoId)) {
    oembedCache.set(
      videoId,
      fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
        { signal: AbortSignal.timeout(6000) }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: any) => d?.author_name || null)
        .catch(() => null)
    );
  }
  return oembedCache.get(videoId)!;
}

async function bestYoutubeStill(videoId: string): Promise<string> {
  const maxres = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  try {
    const r = await fetch(maxres, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    if (r.ok) return maxres;
  } catch {
    // fall through to the always-present still
  }
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchOgImage(pageUrl: string): Promise<string | null> {
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": WIRE_UA, Accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const html = (await response.text()).slice(0, 400000);
  let fallback: string | null = null;
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const a = parseAttrs(m[0]);
    const key = (a.property || a.name || "").toLowerCase();
    if (!a.content) continue;
    if (JUNK_IMAGE.test(a.content)) continue;
    if (key === "og:image" || key === "og:image:secure_url") return new URL(a.content, pageUrl).toString();
    if (key === "twitter:image" && !fallback) fallback = new URL(a.content, pageUrl).toString();
  }
  return fallback;
}

interface Enrichment {
  film?: FilmMatch;
  trailerCredit?: string;
  still?: string;
  ogImage?: string;
  hadError?: boolean;
}

async function enrichStory(s: WireStory): Promise<Enrichment> {
  const out: Enrichment = {};
  const step = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch {
      out.hadError = true;
    }
  };
  await Promise.all([
    step(async () => {
      if (s.trailer) out.still = await bestYoutubeStill(s.trailer.youtubeId);
    }),
    step(async () => {
      if (!s.image && s.kind === "news") out.ogImage = (await fetchOgImage(s.url)) || undefined;
    }),
    step(async () => {
      if (!process.env.TMDB_API_KEY || !s.candidates.length) return;
      out.film = (await matchFilm(s.candidates)) || undefined;
      if (out.film?.trailerKey && !s.trailer) {
        out.trailerCredit = (await youtubeChannelName(out.film.trailerKey)) || undefined;
      }
    }),
  ]);
  return out;
}

function createLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= limit || !queue.length) return;
    active++;
    queue.shift()!();
  };
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          })
      );
      next();
    });
}

const enrichLimit = createLimiter(6);
const enrichments = new Map<string, { at: number; done: boolean; result?: Enrichment; promise: Promise<void> }>();

function scheduleEnrichment(s: WireStory) {
  const existing = enrichments.get(s.id);
  if (existing && !(existing.done && existing.result?.hadError && Date.now() - existing.at > 5 * 60 * 1000)) {
    return existing.promise;
  }
  const entry: { at: number; done: boolean; result?: Enrichment; promise: Promise<void> } = {
    at: Date.now(),
    done: false,
    promise: Promise.resolve(),
  };
  entry.promise = enrichLimit(() => enrichStory(s)).then(
    (result) => {
      entry.result = result;
      entry.done = true;
    },
    () => {
      entry.result = { hadError: true };
      entry.done = true;
    }
  );
  enrichments.set(s.id, entry);
  while (enrichments.size > 1500) enrichments.delete(enrichments.keys().next().value as string);
  return entry.promise;
}

function applyEnrichment(s: WireStory): WireStory {
  const e = enrichments.get(s.id)?.result;
  if (!e) return { ...s };
  const out: WireStory = { ...s };
  if (e.still && out.trailer) out.image = { url: e.still, credit: out.source, official: true };
  if (e.film) {
    const { trailerKey, trailerName, ...film } = e.film;
    out.film = film;
    if (!out.trailer && trailerKey && e.trailerCredit) {
      out.trailer = {
        youtubeId: trailerKey,
        url: `https://www.youtube.com/watch?v=${trailerKey}`,
        name: trailerName || `${film.title} — Official Trailer`,
        credit: e.trailerCredit,
      };
    }
    if (film.backdrop && out.kind === "news") {
      out.image = { url: film.backdrop, credit: film.studio ? `${film.studio} via TMDB` : "TMDB", official: true };
    }
  }
  if (!out.image && e.ogImage) out.image = { url: e.ogImage, credit: out.source, official: false };
  return out;
}

// Coverage = how many outlets on the current wire are on the same film — a
// real count, shown as a buzz badge when it's 2+.
function publicStories(base: WireStory[]) {
  const merged = base.map(applyEnrichment);
  // A trade's "'Day Drinker' Trailer" story gets the studio's own upload
  // (already on the wire from the official channel) — no key needed.
  const studioTrailers = new Map<string, WireTrailer>();
  for (const s of merged) {
    if (s.kind !== "trailers" || !s.trailer) continue;
    for (const c of s.candidates) if (!studioTrailers.has(normTitle(c))) studioTrailers.set(normTitle(c), s.trailer);
    if (s.film && !studioTrailers.has(`tmdb:${s.film.tmdbId}`)) studioTrailers.set(`tmdb:${s.film.tmdbId}`, s.trailer);
  }
  for (const s of merged) {
    if (s.trailer) continue;
    const hit =
      (s.film && studioTrailers.get(`tmdb:${s.film.tmdbId}`)) ||
      s.candidates.map((c) => studioTrailers.get(normTitle(c))).find(Boolean);
    if (hit) s.trailer = hit;
  }
  const keyOf = (s: WireStory) =>
    s.film ? `tmdb:${s.film.tmdbId}` : s.candidates[0] ? `t:${normTitle(s.candidates[0])}` : null;
  const outlets = new Map<string, Set<string>>();
  for (const s of merged) {
    const k = keyOf(s);
    if (!k) continue;
    if (!outlets.has(k)) outlets.set(k, new Set());
    outlets.get(k)!.add(s.sourceId);
  }
  return merged.map(({ candidates, ...story }) => {
    const k = keyOf({ ...story, candidates });
    return { ...story, coverage: k ? outlets.get(k)!.size : 1 };
  });
}

let wireState: { at: number; stories: WireStory[]; sources: WireSourceStatus[] } | null = null;
let wireInflight: Promise<void> | null = null;
const WIRE_TTL_MS = 10 * 60 * 1000;
const ENRICH_HEADSTART_MS = 4500;

function refreshWire(): Promise<void> {
  if (!wireInflight) {
    wireInflight = buildWire()
      .then(({ stories, sources }) => {
        wireState = { at: Date.now(), stories, sources };
        stories.forEach(scheduleEnrichment);
      })
      .finally(() => {
        wireInflight = null;
      });
  }
  return wireInflight;
}

app.get("/api/news/feed", async (req, res) => {
  try {
    const age = wireState ? Date.now() - wireState.at : Infinity;
    const forced = req.query.refresh === "1" && age > 60000; // be polite to the outlets
    if (!wireState || forced) {
      await refreshWire();
    } else if (age > WIRE_TTL_MS) {
      refreshWire().catch(() => {}); // serve the current reel while the next one loads
    }
    const state = wireState!;
    // Give first-pass enrichment a head start so the deck opens with art.
    const pending = () => state.stories.filter((s) => !enrichments.get(s.id)?.done);
    if (req.query.wait !== "0" && pending().length) {
      await Promise.race([
        Promise.all(pending().map((s) => enrichments.get(s.id)?.promise)),
        new Promise((r) => setTimeout(r, ENRICH_HEADSTART_MS)),
      ]);
    }
    res.json({
      success: true,
      fetchedAt: new Date(state.at).toISOString(),
      stories: publicStories(state.stories),
      sources: state.sources,
      enrichment: { tmdb: Boolean(process.env.TMDB_API_KEY), pending: pending().length },
    });
  } catch (error: any) {
    console.error("Newsreel feed error:", error);
    res.status(502).json({ error: error.message || "The wire is down." });
  }
});

// --- Hot takes ----------------------------------------------------------------
// Takes are written as Dalton, from voice/newsreel-voice.md: his journal voice
// rules plus lines from his own published posts. The file is re-read whenever
// it changes, so the voice can be tuned without touching code or restarting.

type Spice = "mild" | "hot" | "scorching";

const VOICE_FILE = path.join(process.cwd(), "voice", "newsreel-voice.md");
let voiceCache: { mtimeMs: number; text: string } | null = null;

function newsreelVoice(): string {
  try {
    const { mtimeMs } = fs.statSync(VOICE_FILE);
    if (!voiceCache || voiceCache.mtimeMs !== mtimeMs) {
      voiceCache = { mtimeMs, text: fs.readFileSync(VOICE_FILE, "utf8") };
    }
    return voiceCache.text;
  } catch {
    // Missing file (odd install): the short version still beats nothing.
    return "Write as Dalton, first person, conversational and opinion-first: the point in the first sentence, specifics dropped in passing, a short landing line. Never hedge, never summarize the press release, never invent facts.";
  }
}

const SPICE_NOTES: Record<Spice, string> = {
  mild: "The fan leads. Real warmth or excitement, still a clear position, a landing with a smile in it.",
  hot: "Dalton's default register: a clear call, one or two sharp specifics, a short verdict line to close.",
  scorching:
    "Savage. Name exactly why the choice is smart or baffling, no cushioning, specifics behind every shot. Brutal about the work and the business, never about anyone's body, private life, or identity.",
};

// Phrases the journal voice bans outright — a draft that uses one gets sent
// back once with the offenders named.
const VOICE_BANNED: Array<[RegExp, string]> = [
  [/\bthis matters because\b/i, "this matters because"],
  [/\bthis is significant\b/i, "this is significant"],
  [/\bthis (?:trend )?signals\b/i, "this signals"],
  [/\b(?:it'?s|it is) worth noting\b|\bworth noting\b/i, "worth noting"],
  [/\bnotably\b/i, "notably"],
  [/\bas (?:we|you) know\b/i, "as we know"],
  [/\bfor context\b/i, "for context"],
  [/\brecall that\b/i, "recall that"],
  [/\bit bears mentioning\b/i, "it bears mentioning"],
  [/\bonly time will tell\b/i, "only time will tell"],
  [/\bhighly anticipated\b/i, "highly anticipated"],
  [/\bfans will be\b/i, "fans will be"],
  [/\bcould potentially\b/i, "could potentially"],
  [/\breshap(?:e|es|ing) the landscape\b/i, "reshaping the landscape"],
  [/\bbroader trend\b/i, "broader trend"],
  [/\bbuckle up\b/i, "buckle up"],
  [/\bfilm fans\b/i, "film fans"],
  [/\bgame[- ]changer\b/i, "game-changer"],
  [/\blet that sink in\b/i, "let that sink in"],
  [/\bjust announced\b/i, "just announced"],
  [/\bwhat do you think\b|\bthoughts\?/i, "a generic 'thoughts?' closer"],
  [/\bis the real story\b/i, "is the real story"],
  [/\btells you exactly\b/i, "tells you exactly"],
];

function voiceProblems(data: { take: string; post: string }): string[] {
  const problems: string[] = [];
  const text = `${data.take}\n${data.post}`;
  for (const [re, label] of VOICE_BANNED) if (re.test(text)) problems.push(`uses "${label}"`);
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push("uses emoji");
  if (/#\w/.test(data.post)) problems.push("puts hashtags in the post");
  if (data.post.length > 260) problems.push(`post is ${data.post.length} characters (max 240)`);
  const words = data.take.split(/\s+/).filter(Boolean).length;
  if (words > 110) problems.push(`take is ${words} words (max 90)`);
  if (words < 15) problems.push("take is too thin to carry a position");
  return problems;
}

interface TakeStory {
  id?: string;
  title: string;
  source: string;
  summary?: string;
  category?: string;
  film?: { title?: string; year?: string };
}

function takePromptBody(s: TakeStory, spice: Spice): string {
  return `${newsreelVoice()}

---

Write the Newsreel take on the wire story below, as Dalton, in exactly the voice above. Study the examples: that rhythm and that kind of specific, not generic "critic" copy.

Heat: ${spice.toUpperCase()} — ${SPICE_NOTES[spice]}

The story (these are the only facts you have about it):
- Headline: ${s.title}
- Outlet: ${s.source}
- Category: ${s.category || "news"}${s.film?.title ? `\n- Film: ${s.film.title}${s.film.year ? ` (${s.film.year})` : ""}` : ""}
- What the outlet reported: ${s.summary || "(headline only)"}

Beyond these facts, mention an outside credit only if it is famous and you are certain of it — a wrong credit under Dalton's name is worse than no credit. When in doubt, leave it out. Never invent numbers, dates, quotes, reactions, or cast.

Return:
1. summary: one plain sentence on what happened, max 30 words. This line is NOT in the voice — it is the neutral fact line under the headline.
2. take: Dalton's take, 2–4 sentences, 40–90 words. The position in the first sentence, one or two specifics carrying it, a short landing line to close.
3. post: the take cut down for X / Threads / Bluesky, max 240 characters, no link, no hashtags, no emoji. It must sound like Dalton talking, not a caption. End on the landing, or on a sharp question only if the story has a real tension worth arguing about.
4. hashtags: 0–2 tags, only ones film Twitter actually uses for this (e.g. the title as a tag). Otherwise an empty list.`;
}

const TAKE_REQUIRED_KEYS = ["summary", "take", "post", "hashtags"];

// No model, no take: canned lines can't sound like Dalton, so offline mode
// returns the outlet's facts and leaves the take empty.
function templateTake(s: TakeStory) {
  const firstSentence = (s.summary || "").match(/^.{20,240}?[.!?](?=\s|$)/)?.[0] || s.summary || s.title;
  return { summary: firstSentence, take: "", post: s.title, hashtags: [] as string[] };
}

function cleanTake(data: any) {
  const tags = Array.isArray(data.hashtags) ? data.hashtags : String(data.hashtags || "").split(/[\s,]+/);
  return {
    summary: String(data.summary || "").trim(),
    take: String(data.take || "").trim(),
    post: String(data.post || "").trim(),
    hashtags: tags
      .map((t: string) => String(t).trim())
      .filter(Boolean)
      .map((t: string) => (t.startsWith("#") ? t : `#${t}`).replace(/\s+/g, ""))
      .slice(0, 2),
  };
}

async function draftTake(provider: "claude" | "gemini", prompt: string) {
  if (provider === "claude") {
    const raw = await runClaudeCli(`${prompt}

Respond with ONLY a valid JSON object — no markdown fences, no commentary — with exactly these keys:
{"summary": string, "take": string, "post": string, "hashtags": string[]}`);
    return cleanTake(validateKeys(extractJsonObject(raw), TAKE_REQUIRED_KEYS));
  }
  const ai = getGeminiAI();
  if (!ai) throw new Error("GEMINI_API_KEY not configured");
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          take: { type: Type.STRING },
          post: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: TAKE_REQUIRED_KEYS,
      },
    },
  });
  if (!response.text) throw new Error("No response generated from Gemini.");
  return cleanTake(validateKeys(JSON.parse(response.text), TAKE_REQUIRED_KEYS));
}

async function generateHotTake(s: TakeStory, spice: Spice): Promise<{ provider: ProviderName; data: any }> {
  const order = await resolveProviderOrder();
  let lastError: Error | null = null;

  for (const provider of order) {
    try {
      if (provider === "template") return { provider, data: templateTake(s) };
      const prompt = takePromptBody(s, spice);
      const first = await draftTake(provider, prompt);
      const problems = voiceProblems(first);
      if (!problems.length) return { provider, data: first };
      // One rewrite with the exact problems named; keep whichever is cleaner.
      const second = await draftTake(
        provider,
        `${prompt}

Your previous draft broke the voice: ${problems.join("; ")}. Previous take: "${first.take}" Rewrite it so it sounds like Dalton — same facts, no banned phrases.`
      ).catch(() => first);
      return { provider, data: voiceProblems(second).length <= problems.length ? second : first };
    } catch (err: any) {
      lastError = err;
      console.warn(`[ai] provider "${provider}" failed: ${err.message} — trying next`);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

const takeCache = new Map<string, { provider: ProviderName; data: any }>();

app.post("/api/news/take", async (req, res) => {
  const { id, spice: rawSpice, regenerate, story: clientStory } = req.body || {};
  const spice: Spice = ["mild", "hot", "scorching"].includes(rawSpice) ? rawSpice : "hot";
  // Prefer the server's own copy of the story; fall back to what the client
  // holds (e.g. after a hub restart emptied the wire cache).
  const known = wireState?.stories.find((s) => s.id === id);
  const story: TakeStory | null = known
    ? { ...applyEnrichment(known) }
    : clientStory?.title
      ? {
          id: String(id || ""),
          title: String(clientStory.title).slice(0, 300),
          source: String(clientStory.source || "the trades").slice(0, 80),
          summary: String(clientStory.summary || "").slice(0, 600),
          category: String(clientStory.category || "news"),
          film: clientStory.film?.title ? { title: String(clientStory.film.title), year: clientStory.film.year } : undefined,
        }
      : null;
  if (!story) return res.status(404).json({ error: "Story not found on the current wire — refresh the reel." });

  const cacheKey = `${story.id || story.title}|${spice}`;
  if (!regenerate && takeCache.has(cacheKey)) {
    return res.json({ success: true, cached: true, ...takeCache.get(cacheKey) });
  }
  try {
    const result = await generateHotTake(story, spice);
    takeCache.set(cacheKey, result);
    while (takeCache.size > 500) takeCache.delete(takeCache.keys().next().value as string);
    res.json({ success: true, cached: false, ...result });
  } catch (error: any) {
    console.error("Hot take error:", error);
    res.status(500).json({ error: error.message || "Couldn't get a take." });
  }
});

// ---------------------------------------------------------------------------
// Start Express + Vite server
// ---------------------------------------------------------------------------

// Production when NODE_ENV says so, or via the --prod flag — the flag keeps
// `npm start` working on Windows, where VAR=value command prefixes don't exist.
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.argv.includes("--prod");

async function startServer() {
  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", async () => {
    const order = await resolveProviderOrder();
    console.log(`LUNARA FILM Hub server active on http://localhost:${PORT}`);
    const lanAddresses = Object.values(os.networkInterfaces())
      .flatMap((iface) => iface ?? [])
      .filter((addr) => addr.family === "IPv4" && !addr.internal)
      .map((addr) => addr.address);
    for (const address of lanAddresses) {
      console.log(`[phone] same Wi-Fi: http://${address}:${PORT} (allow Node through the firewall if prompted)`);
    }
    console.log(`[ai] provider order: ${order.join(" → ")}`);
    console.log(`[wp] journal sync source: ${WP_SITE} (${WP_POST_TYPES.join(", ")})`);
    console.log(`[typefully] dispatch: ${process.env.TYPEFULLY_API_KEY ? "enabled (API v2)" : "disabled (no key)"}`);
    console.log(`[buffer] dispatch: ${process.env.BUFFER_API_KEY ? "enabled" : "disabled (no key)"}`);
    const sources = wireSources();
    console.log(
      `[newsreel] ${sources.filter((s) => s.kind === "news").length} news feeds + ${
        sources.filter((s) => s.kind === "trailers").length
      } studio trailer channels · TMDB art ${process.env.TMDB_API_KEY ? "on" : "off (no TMDB_API_KEY)"}`
    );
  });

  // A busy port almost always means the hub is already running (auto-start,
  // or an earlier window). Say so plainly instead of dumping a stack trace.
  server.on("error", async (err: NodeJS.ErrnoException) => {
    if (err.code !== "EADDRINUSE") throw err;
    let alreadyHub = false;
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      const data: any = await res.json().catch(() => ({}));
      alreadyHub = Boolean(data?.aiProviderOrder);
    } catch {
      // nothing hub-like answered — some other app owns the port
    }
    if (alreadyHub) {
      console.log(`LUNARA Hub is already running — open http://localhost:${PORT}`);
      console.log(
        `(To launch a NEW build, stop the old copy first: close the "LUNARA Hub" window, or run: npm run update)`
      );
      process.exit(0);
    } else {
      console.error(
        `Port ${PORT} is taken by another app. Set a different PORT in .env (e.g. PORT=3001) and try again.`
      );
      process.exit(1);
    }
  });
}

// Loopback-only restart hook so `npm run update` can hand off to a new build
// without anyone hunting processes. Refuses non-local callers.
app.post("/api/_local/shutdown", (req, res) => {
  const ip = req.socket.remoteAddress || "";
  const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLoopback) {
    res.status(403).json({ error: "Local requests only." });
    return;
  }
  res.json({ ok: true, message: "Shutting down for update." });
  console.log("[update] shutdown requested by local updater — exiting.");
  setTimeout(() => process.exit(0), 300);
});

startServer();
