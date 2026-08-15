import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini AI SDK securely on server side
let ai: GoogleGenAI | null = null;
function getGeminiAI() {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// Health Check API
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Gemini Social Copy Generation
app.post("/api/gemini/generate-social", async (req, res) => {
  try {
    const { filmTitle, director, rating, journalNotes, targetPlatforms, tone, articleUrl } = req.body;

    const gemini = getGeminiAI();
    if (!gemini) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured in secrets. Using smart fallback template generation.",
        fallback: true
      });
    }

    const prompt = `You are the lead Social Media Director and Chief Film Critic at LUNARA FILM (a sleek, high-brow yet accessible film journal & editorial website).
Create social media post variations for LUNARA FILM's social media platforms.

Film Details:
- Title: ${filmTitle || "Untitled Film"}
- Director: ${director || "N/A"}
- Star Rating: ${rating ? `${rating}/5 Stars` : "Not rated"}
- Film Journal Notes/Review Snippet: ${journalNotes || "General film coverage and review."}
- Tone Strategy: ${tone || "Cinephile Editorial"}
- LUNARA FILM Website Link: ${articleUrl || "https://lunarafilm.com/reviews/latest"}
- Target Platforms requested: ${(targetPlatforms || ["Twitter/X", "Instagram", "Letterboxd", "TikTok"]).join(", ")}

Generate tailored posts in structured JSON format with:
1. twitterCopy: Punchy X/Twitter post or thread hook (under 280 chars, stylish, film-nerd aesthetic).
2. instagramCaption: Engaging Instagram carousel/photo caption with formatting, paragraph breaks, and strong CTA to link in bio.
3. letterboxdReview: Sophisticated, sharp Letterboxd review snippet or log comment.
4. tikTokScript: A 15-30 second video script outline (Hook, On-screen text, Visual cue, Audio cue).
5. hashtags: Array of 5-8 relevant trending and niche film hashtags (e.g., #LunaraFilm, #Cinema, etc.).
6. engagementScore: Estimated viral potential score from 1-100.
7. engagementAdvice: 1 sentence advice on optimal timing or image asset pairing for max reach.
`;

    const response = await gemini.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
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
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            engagementScore: { type: Type.NUMBER },
            engagementAdvice: { type: Type.STRING }
          },
          required: ["twitterCopy", "instagramCaption", "letterboxdReview", "tikTokScript", "hashtags", "engagementScore", "engagementAdvice"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response generated from Gemini.");
    }

    const parsed = JSON.parse(resultText);
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("Error generating social copy:", error);
    res.status(500).json({ error: error.message || "Failed to generate social copy." });
  }
});

// Gemini Copy Polisher / Optimizer
app.post("/api/gemini/polish-copy", async (req, res) => {
  try {
    const { draftText, platform, goal } = req.body;

    const gemini = getGeminiAI();
    if (!gemini) {
      return res.status(503).json({ error: "GEMINI_API_KEY missing." });
    }

    const prompt = `Refine and polish this social draft for LUNARA FILM for platform: ${platform || "Twitter"}.
Goal: ${goal || "Increase engagement and sound authoritative yet passionate about cinema"}.

Draft:
"${draftText}"

Provide 3 distinct polished versions in JSON:
1. concise: Short, punchy, scroll-stopping.
2. editorial: Deep, analytical, cinephile depth.
3. provocative: High engagement, conversation starter / hot take angle.
`;

    const response = await gemini.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concise: { type: Type.STRING },
            editorial: { type: Type.STRING },
            provocative: { type: Type.STRING }
          },
          required: ["concise", "editorial", "provocative"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("Error polishing copy:", error);
    res.status(500).json({ error: error.message || "Failed to polish copy." });
  }
});

// Start Express + Vite server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LUNARA FILM Hub server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
