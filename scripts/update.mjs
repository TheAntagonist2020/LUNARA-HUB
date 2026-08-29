// LUNARA Hub one-command update: pull → (install if needed) → build →
// restart. Replaces the pull/build/close-window/start ritual with
// `npm run update`. Safe to run any time; if nothing changed it just
// rebuilds and restarts.
import { spawnSync, spawn } from "child_process";
import fs from "fs";

const env = {};
try {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  // no .env — PORT default still applies
}
const PORT = Number(env.PORT) || 3000;
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const run = (cmd, args, label) => {
  console.log(`\n[update] ${label}`);
  const result = spawnSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: isWindows, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    console.error(`[update] "${label}" failed — stopping here. Fix the error above and re-run: npm run update`);
    process.exit(1);
  }
  return result.stdout || "";
};

const pullOutput = run("git", ["pull"], "Pulling latest changes");
if (/package(-lock)?\.json/.test(pullOutput)) {
  run(npmCmd, ["install"], "Dependencies changed — installing");
}
run(npmCmd, ["run", "build"], "Building");

// Ask any running hub to step aside (loopback-only endpoint; older builds
// without it just won't answer — then the port stays busy and the fresh
// start below reports it cleanly).
console.log("\n[update] Restarting the hub");
try {
  await fetch(`http://localhost:${PORT}/api/_local/shutdown`, {
    method: "POST",
    signal: AbortSignal.timeout(3000),
  });
  await new Promise((r) => setTimeout(r, 1200));
} catch {
  // nothing was running (or an old build without the hook) — fine
}

const child = spawn(npmCmd, ["start"], {
  detached: true,
  stdio: "ignore",
  shell: isWindows,
});
child.unref();

// Confirm the new build actually came up.
let healthy = false;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 700));
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      healthy = true;
      break;
    }
  } catch {
    // not up yet
  }
}

if (healthy) {
  console.log(`\n[update] Done — the hub is running the new build at http://localhost:${PORT}`);
  console.log(`[update] Phone address unchanged; the home-screen app picks this up on next open.`);
} else {
  console.error(
    `\n[update] Built fine, but the hub didn't answer on port ${PORT}. An old copy may still hold the port — close the "LUNARA Hub" window and run: npm start`
  );
  process.exit(1);
}
