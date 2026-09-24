// LUNARA Hub doctor — one-command check that everything is configured and
// connected. Run `npm run dev` in one terminal, then `npm run doctor` in
// another. Reads .env key NAMES only; never prints secret values.
import fs from "fs";

const env = {};
try {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  // handled below
}

const port = Number(env.PORT) || 3000;
const base = `http://localhost:${port}`;
const lines = [];
const flag = (okay) => (okay ? "[ OK ]" : "[ -- ]");

lines.push("LUNARA FILM Hub — connection doctor");
lines.push("");

const hasEnv = Object.keys(env).length > 0;
lines.push(`${flag(hasEnv)} .env file ${hasEnv ? "found" : "NOT FOUND — run: cp .env.example .env"}`);
for (const key of ["WP_USERNAME", "WP_APP_PASSWORD", "TYPEFULLY_API_KEY", "BUFFER_API_KEY", "TMDB_API_KEY", "GEMINI_API_KEY"]) {
  lines.push(`       ${key.padEnd(18)} ${env[key] ? "set" : "not set"}`);
}
lines.push("");

try {
  const health = await (await fetch(`${base}/api/health`)).json();
  const i = health.integrations || {};
  lines.push(`${flag(true)} Hub server running at ${base}`);
  lines.push(`${flag(true)} AI engine: ${health.aiProviderOrder?.join(" → ")}`);
  lines.push(
    `${flag(i.claudeCli)} Claude CLI ${
      i.claudeCli
        ? "detected — subscription billing, $0 extra"
        : "not detected — npm install -g @anthropic-ai/claude-code, then run claude to log in"
    }`
  );
  lines.push(
    `${flag(i.wordpressWrite)} WordPress write ${
      i.wordpressWrite
        ? "ARMED — featured-image pipeline live"
        : "off — add WP_USERNAME + WP_APP_PASSWORD to .env and restart"
    }`
  );
  // Real calls, not just "a key is present" — a pre-v2 Typefully key or a
  // revoked Buffer key shows up here instead of on your first dispatch.
  if (i.typefullyKey) {
    const tf = await (await fetch(`${base}/api/typefully/status`)).json().catch(() => ({ error: "no answer" }));
    lines.push(
      `${flag(!tf.error)} Typefully ${
        tf.error ? `key REJECTED — ${tf.error}` : `connected (API v2) — drafts go to ${tf.platforms.join(", ")}`
      }`
    );
  } else {
    lines.push(`${flag(false)} Typefully off — add TYPEFULLY_API_KEY (v2) to .env and restart`);
  }
  if (i.bufferKey) {
    const bf = await (await fetch(`${base}/api/buffer/channels`)).json().catch(() => ({ error: "no answer" }));
    const usable = (bf.channels || []).filter((c) => c.usable).length;
    lines.push(
      `${flag(!bf.error)} Buffer ${bf.error ? `key REJECTED — ${bf.error}` : `connected — ${usable} text channel(s) ready`}`
    );
  } else {
    lines.push(`${flag(false)} Buffer off — optional; add BUFFER_API_KEY to .env and restart`);
  }
  lines.push(
    `${flag(i.tmdbKey)} TMDB ${
      i.tmdbKey ? "on — Newsreel pulls official key art + trailers" : "off — optional; add TMDB_API_KEY for official key art"
    }`
  );

  const wp = await (await fetch(`${base}/api/wordpress/journal`)).json();
  lines.push(
    `${flag(wp.count > 0)} Live site sync ${
      wp.count > 0 ? `OK — ${wp.count} published posts readable from ${wp.site}` : `FAILED — ${wp.error || "no posts returned"}`
    }`
  );
  const wire = await (await fetch(`${base}/api/news/feed?wait=0`)).json().catch(() => ({ error: "no answer" }));
  const live = (wire.sources || []).filter((s) => s.ok);
  const down = (wire.sources || []).filter((s) => !s.ok);
  lines.push(
    `${flag(!wire.error && live.length > 0)} Newsreel wire ${
      wire.error ? `FAILED — ${wire.error}` : `${wire.stories?.length || 0} stories from ${live.length}/${wire.sources.length} sources`
    }`
  );
  for (const s of down) lines.push(`       ${s.label.padEnd(22)} ${s.error}`);
  lines.push("");
  lines.push("Every line [ OK ] above means the hub is fully connected (Buffer and TMDB are optional).");
} catch {
  lines.push(`${flag(false)} Hub server NOT reachable at ${base}`);
  lines.push("       Start it first:  npm run dev   (then run npm run doctor in a second terminal)");
}

console.log(lines.join("\n"));
