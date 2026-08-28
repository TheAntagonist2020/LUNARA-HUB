// LUNARA vault backfill — rebuild the local media-vault from the live site.
// The WordPress media library is the master archive; this pulls it back down
// so the vault survives any device loss. Idempotent: existing files are
// skipped, so re-running only fetches what's missing.
//
//   npm run vault:backfill                  # media from the last 12 months
//   npm run vault:backfill -- --since 2026-08   # from a given month
//   npm run vault:backfill -- --all         # the entire library (large!)
//   npm run vault:backfill -- --limit 50    # cap the number of downloads
import fs from "fs";
import path from "path";

const env = {};
try {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  // no .env — defaults below still work for a public-site backfill
}

const WP_SITE = (env.WP_SITE || "lunarafilm.com").replace(/^https?:\/\//, "");
const VAULT_DIR = env.MEDIA_VAULT_DIR || "./media-vault";

const args = process.argv.slice(2);
const flagValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ALL = args.includes("--all");
const LIMIT = Number(flagValue("--limit")) || Infinity;
const sinceArg = flagValue("--since");

let after;
if (ALL) {
  after = undefined;
} else if (sinceArg) {
  if (!/^\d{4}-\d{2}$/.test(sinceArg)) {
    console.error(`--since must be YYYY-MM (got "${sinceArg}")`);
    process.exit(1);
  }
  after = `${sinceArg}-01T00:00:00`;
} else {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  after = d.toISOString().replace(/\.\d+Z$/, "");
}

const apiBase = `https://${WP_SITE}/wp-json/wp/v2/media`;
const scope = ALL ? "entire library" : `since ${after.slice(0, 10)}`;
console.log(`LUNARA vault backfill — ${WP_SITE} (${scope})`);
console.log(`Vault: ${path.resolve(VAULT_DIR)}`);

let page = 1;
let saved = 0;
let skipped = 0;
let failed = 0;

outer: while (true) {
  const url = new URL(apiBase);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");
  url.searchParams.set("_fields", "id,date,source_url,mime_type");
  if (after) url.searchParams.set("after", after);

  const res = await fetch(url);
  if (res.status === 400) break; // past the last page
  if (!res.ok) {
    console.error(`Media list request failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const items = await res.json();
  if (!Array.isArray(items) || items.length === 0) break;

  for (const item of items) {
    if (saved >= LIMIT) break outer;
    if (!item.source_url) continue;
    const month = (item.date || "").slice(0, 7) || "unknown";
    const dir = path.join(VAULT_DIR, month);
    const filename = decodeURIComponent(
      new URL(item.source_url).pathname.split("/").pop() || `media-${item.id}`
    );
    const dest = path.join(dir, filename);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    try {
      const fileRes = await fetch(item.source_url);
      if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await fileRes.arrayBuffer()));
      saved++;
      console.log(`  saved   ${month}/${filename}`);
    } catch (err) {
      failed++;
      console.error(`  FAILED  ${filename} — ${err.message}`);
    }
  }

  const totalPages = Number(res.headers.get("x-wp-totalpages")) || page;
  if (page >= totalPages) break;
  page++;
}

console.log("");
console.log(`Done: ${saved} saved, ${skipped} already in vault, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
