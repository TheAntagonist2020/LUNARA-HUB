// LUNARA Hub setup — writes a guaranteed-correct .env by asking questions.
// Run it from the repo folder: npm run setup
// No hand-editing, no comment marks to trip over, no encoding surprises.
// Keys are written raw exactly as pasted (WP Application Passwords keep
// their spaces). Re-run any time; it asks before overwriting.
import fs from "fs";
import readline from "readline/promises";

// Interactive terminal → real prompts. Piped stdin → answers read line by
// line (used by tests and scripted installs).
const interactive = process.stdin.isTTY;
let rl;
let pipedLines = [];
if (interactive) {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  pipedLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

const ask = async (q, fallback = "") => {
  const prompt = fallback ? `${q} [${fallback}]: ` : `${q}: `;
  const answer = interactive ? await rl.question(prompt) : (pipedLines.shift() ?? "");
  return answer.trim() || fallback;
};

console.log("LUNARA FILM Hub setup — paste each value raw, or Enter to skip/accept default.\n");

if (fs.existsSync(".env")) {
  const overwrite = await ask("A .env already exists here. Overwrite it? (y/N)", "N");
  if (!/^y/i.test(overwrite)) {
    console.log("Left the existing .env untouched.");
    if (rl) rl.close();
    process.exit(0);
  }
}

const wpSite = await ask("WordPress site", "lunarafilm.com");
const wpUser = await ask("WordPress username", "lunarafilm");
const wpPass = await ask("WordPress Application Password (spaces included)");
const typefully = await ask("Typefully API key");
const gemini = await ask("Gemini API key (optional)");
const vaultDir = await ask("Media vault folder", "./media-vault");
if (rl) rl.close();

const envFile = [
  "AI_PROVIDER=auto",
  `WP_SITE=${wpSite}`,
  "WP_POST_TYPES=review,journal,posts",
  `WP_USERNAME=${wpUser}`,
  `WP_APP_PASSWORD=${wpPass}`,
  `TYPEFULLY_API_KEY=${typefully}`,
  `GEMINI_API_KEY=${gemini}`,
  `MEDIA_VAULT_DIR=${vaultDir}`,
  "PORT=3000",
  "",
].join("\n");

fs.writeFileSync(".env", envFile, "utf8");

const set = (v) => (v ? "set" : "not set");
console.log("\n.env written. Summary (values hidden):");
console.log(`  WordPress write  ${set(wpPass)} (${wpUser}@${wpSite})`);
console.log(`  Typefully        ${set(typefully)}`);
console.log(`  Gemini fallback  ${set(gemini)}`);
console.log(`  Media vault      ${vaultDir}`);
console.log("\nNext: npm run doctor   (then npm start)");
