import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
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
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    aiProviderOrder: order,
    integrations: {
      claudeCli: order.includes("claude"),
      geminiKey: Boolean(process.env.GEMINI_API_KEY),
      typefullyKey: Boolean(process.env.TYPEFULLY_API_KEY),
      wordpressSite: process.env.WP_SITE || "lunarafilm.com",
      wordpressWrite: Boolean(process.env.WP_USERNAME && process.env.WP_APP_PASSWORD),
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

app.post("/api/wordpress/featured-image", async (req, res) => {
  const { postId, postType, imageUrl, alt, filename } = req.body || {};
  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required." });
  }

  try {
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (LUNARA Hub media pipeline)" },
    });
    if (!imgRes.ok) {
      return res.status(502).json({ error: `Could not download image (HTTP ${imgRes.status}) from ${imageUrl}` });
    }
    const contentType = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ error: `URL did not return an image (got ${contentType}).` });
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // Local backup first — the vault copy survives even if the upload fails.
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
    const vaultDir = path.join(MEDIA_VAULT_DIR, new Date().toISOString().slice(0, 7));
    fs.mkdirSync(vaultDir, { recursive: true });
    const vaultPath = path.join(vaultDir, `${Date.now()}-${baseName}.${ext}`);
    fs.writeFileSync(vaultPath, buffer);

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
    console.error("Featured image pipeline error:", error);
    res.status(500).json({ error: error.message || "Featured image pipeline failed." });
  }
});

// ---------------------------------------------------------------------------
// Typefully dispatch — sends generated copy straight into your Typefully
// drafts. The API is included free with an existing Typefully account:
// Typefully → Settings → Integrations → API.
// ---------------------------------------------------------------------------

app.post("/api/typefully/draft", async (req, res) => {
  const apiKey = process.env.TYPEFULLY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error:
        "TYPEFULLY_API_KEY is not set. Grab a free key from Typefully → Settings → Integrations → API and add it to .env.",
    });
  }

  const { content, scheduleToNextSlot, threadify } = req.body || {};
  if (!content) {
    return res.status(400).json({ error: "content is required." });
  }

  const body: Record<string, unknown> = { content, threadify: Boolean(threadify) };
  if (scheduleToNextSlot) body["schedule-date"] = "next-free-slot";

  const attempt = (authValue: string) =>
    fetch("https://api.typefully.com/v1/drafts/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": authValue },
      body: JSON.stringify(body),
    });

  try {
    // Typefully's docs show "X-API-KEY: Bearer <key>"; some clients use the bare key.
    let response = await attempt(`Bearer ${apiKey}`);
    if (response.status === 401 || response.status === 403) {
      response = await attempt(apiKey);
    }
    const text = await response.text();
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Typefully API error (${response.status}): ${text.slice(0, 300)}` });
    }
    let draft: any = null;
    try {
      draft = JSON.parse(text);
    } catch {
      draft = { raw: text };
    }
    res.json({ success: true, draft });
  } catch (error: any) {
    console.error("Typefully dispatch error:", error);
    res.status(502).json({ error: error.message || "Failed to reach the Typefully API." });
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

  app.listen(PORT, "0.0.0.0", async () => {
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
    console.log(`[typefully] dispatch: ${process.env.TYPEFULLY_API_KEY ? "enabled" : "disabled (no key)"}`);
  });
}

startServer();
