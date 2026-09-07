// LUNARA editor sweep — the AI-editor seat in lunarafilm.com's Journal
// Control Plane. Lunara Dispatch writes news drafts every 4 hours and parks
// them at `needs_chatgpt_review`; this tool is how the editor (Claude, in a
// Claude Code session or a scheduled routine) reads them, saves a tightened
// revision, validates, and marks them READY so they surface on the site's
// /journal-desk/ page for Dalton's one-tap publish. Publishing itself is
// deliberately NOT a command here — the workflow's `human_publish` rule stays.
//
//   node scripts/editor-sweep.mjs status                 control plane + Dispatch + queue size
//   node scripts/editor-sweep.mjs list [--limit 25]      drafts awaiting the editor, freshest first
//   node scripts/editor-sweep.mjs show <id> [--brief]    full workspace (content, sources, image, validation)
//   node scripts/editor-sweep.mjs save <id> <file.json>  save-validate a revision {title,content,excerpt,acf:{…}}
//   node scripts/editor-sweep.mjs ready <id> [<id>…]     mark validated drafts ready for Dalton
//
// Auth: LUNARA_EDITOR_KEY in .env (wp-admin → Journal Bridge → editor profile →
// Rotate Key). The key is sent only as the X-Lunara-Bridge-Token header to
// WP_SITE and is never printed.
import fs from "fs";
import { spawnSync } from "child_process";

// Node's fetch ignores HTTPS_PROXY unless told otherwise; in a proxied
// environment (Claude Code cloud sessions) re-exec once with it enabled.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY && !process.env.LUNARA_NO_REEXEC) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1", LUNARA_NO_REEXEC: "1" },
  });
  process.exit(r.status ?? 1);
}

const env = { ...process.env };
try {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
} catch {
  // no .env — environment variables alone must carry the config
}

const SITE = (env.WP_SITE || "lunarafilm.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const KEY = env.LUNARA_EDITOR_KEY;
const BASE = `https://${SITE}/wp-json/lunara/v1/`;
const AWAITING = "needs_chatgpt_review";

const args = process.argv.slice(2);
const cmd = args.shift();
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  args.splice(i, v !== undefined && !v.startsWith("--") ? 2 : 1);
  return v !== undefined && !v.startsWith("--") ? v : true;
};

const usage = () => {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(0, 16).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(cmd ? 1 : 0);
};
if (!cmd || cmd === "help" || cmd === "--help") usage();
if (!KEY) {
  console.error("LUNARA_EDITOR_KEY is not set. Add it to .env (wp-admin → Journal Bridge → editor profile → Rotate Key) or export it.");
  process.exit(2);
}

const call = async (method, route, body) => {
  const headers = { "X-Lunara-Bridge-Token": KEY, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const msg = data?.message || data?.raw || `HTTP ${res.status}`;
    throw new Error(`${method} ${route} → ${res.status}: ${msg}`);
  }
  return data;
};

const decode = (s) =>
  String(s ?? "")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&ldquo;|&#8221;|&rdquo;/g, '"')
    .replace(/&amp;/g, "&");

const fetchQueue = async (limit) => {
  const rows = [];
  for (let page = 1; page <= 40; page++) {
    const d = await call("GET", `journal/desk?limit=20&page=${page}&refresh=1`);
    for (const r of d.drafts || []) {
      if (r.journal_status === AWAITING && !r.ready_for_review) rows.push(r);
    }
    if (!d.pagination?.has_more || rows.length >= limit) break;
  }
  return rows.slice(0, limit);
};

const printRow = (r) => {
  const img = r.image?.status || "?";
  const val = r.validation_status || "?";
  const flags = [val === "passed" ? "valid" : `INVALID:${val}`, `image:${img}`];
  if (r.needs_attention) flags.push(`attention: ${(r.attention_reasons || []).join("; ")}`);
  console.log(`${String(r.id).padEnd(7)} ${decode(r.title).slice(0, 72).padEnd(72)}  ${flags.join("  ")}`);
};

try {
  if (cmd === "status") {
    const d = await call("GET", "journal/desk?limit=1&refresh=1");
    const cp = d.control_plane || {};
    const disp = d.dispatch || {};
    const last = disp.last_run || {};
    console.log(`Journal Control Plane ${cp.config_version} — provider ${cp.provider}, schedule ${cp.schedule}`);
    console.log(`Dispatch v${disp.version}: ${disp.enabled ? "enabled" : "DISABLED"}; next run ${disp.next_run_gmt || "?"}`);
    console.log(`Last run ${last.timestamp_gmt || "?"}: ${last.message || "(no message)"}`);
    console.log(`Drafts on the desk: ${d.draft_count}  images: ${JSON.stringify(d.image_counts)}`);
    const queue = await fetchQueue(400);
    const valid = queue.filter((r) => r.validation_status === "passed").length;
    console.log(`Awaiting the editor: ${queue.length} (${valid} already pass validation)`);
    if (d.recommended) console.log(`Desk recommends: ${d.recommended.id} — ${decode(d.recommended.title)}`);
  } else if (cmd === "list") {
    const limit = Number(flag("limit", 25)) || 25;
    const json = flag("json", false);
    const rows = await fetchQueue(limit);
    if (json) {
      console.log(JSON.stringify(rows, null, 1));
    } else {
      if (!rows.length) console.log("Nothing awaiting the editor — the queue is clear.");
      rows.forEach(printRow);
    }
  } else if (cmd === "show") {
    const id = Number(args.shift());
    if (!id) usage();
    const brief = flag("brief", false);
    const d = await call("GET", `journal/desk/drafts/${id}`);
    if (!brief) {
      console.log(JSON.stringify(d, null, 1));
    } else {
      const w = d.workspace;
      console.log(`# ${decode(w.title)}  [${w.acf?.journal_status}${w.acf?.journal_ready_for_review ? ", READY" : ""}]`);
      console.log(`image: ${w.image?.status} ${w.image?.dimensions || ""}  validation: ${d.validation?.valid ? "passed" : "FAILED " + JSON.stringify(d.validation?.errors)}`);
      for (const s of w.acf?.journal_source_items || []) console.log(`source: ${s.source_publication} — ${decode(s.source_headline)}\n        ${s.source_url}`);
      console.log(`\n${w.content}\n`);
      console.log(`deck: ${w.acf?.journal_deck || "(none)"}`);
    }
  } else if (cmd === "save") {
    const id = Number(args.shift());
    const file = args.shift();
    if (!id || !file) usage();
    const body = JSON.parse(fs.readFileSync(file, "utf8"));
    if ("status" in body || "post_status" in body) throw new Error("Refusing: post status changes are not the editor's job (human_publish).");
    const d = await call("POST", `journal/desk/drafts/${id}/save-validate`, body);
    const v = d.validation || {};
    console.log(`${id} saved: ${d.saved}  validation: ${v.valid ? "passed" : "FAILED"}  ready_to_mark: ${d.ready_to_mark}`);
    for (const e of v.errors || []) console.log(`  error: ${e}`);
    for (const wmsg of v.warnings || []) console.log(`  warning: ${wmsg}`);
    if (!v.valid) process.exit(1);
  } else if (cmd === "ready") {
    const ids = args.map(Number).filter(Boolean);
    if (!ids.length) usage();
    let failed = 0;
    for (const id of ids) {
      const d = await call("POST", `journal/desk/drafts/${id}/save-validate`, { acf: { journal_ready_for_review: true } });
      const ok = d.validation?.valid && d.post?.ready_for_review;
      if (!ok) failed++;
      console.log(`${id} ${ok ? "READY for Dalton" : "NOT marked — validation: " + JSON.stringify(d.validation?.errors || d)}`);
    }
    if (failed) process.exit(1);
  } else {
    usage();
  }
} catch (err) {
  console.error(`[editor-sweep] ${err.message}`);
  process.exit(1);
}
