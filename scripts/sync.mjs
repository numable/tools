// Mirror the published official Numable tools into tools/<domain>/.
//
//   mirrored = tools.json whitelist ∩ what /bundle/list publishes (any region)
//
// Each archive is downloaded from the CDN, checked against the sha256 the list advertises and unpacked
// as-is (byte-identical to what the app installs). Tools that are no longer whitelisted or no longer
// published are removed. A published version that talks to a host its whitelist entry has not reviewed
// is NOT applied: the previous copy stays and the run exits 1, so the new host gets a human look first.
//
// Zero dependencies: Node >= 20 (global fetch) and the `unzip` command.
//   node scripts/sync.mjs            sync into ./tools, write index.json and the README table
//   node scripts/sync.mjs --dry-run  only print what would change
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS_DIR = join(ROOT, "tools");
const API = (process.env.NUMABLE_API || "https://api.numable.app").replace(/\/+$/, "");
const REGIONS = ["overseas", "cn"];
const DRY = process.argv.includes("--dry-run");

const whitelist = JSON.parse(readFileSync(join(ROOT, "tools.json"), "utf8")).tools;
const prevIndex = existsSync(join(ROOT, "index.json")) ? JSON.parse(readFileSync(join(ROOT, "index.json"), "utf8")).tools : [];
const prevById = new Map(prevIndex.map((t) => [t.id, t]));

async function fetchList(region) {
  const res = await fetch(`${API}/bundle/list`, { headers: { "x-region": region } });
  if (!res.ok) throw new Error(`/bundle/list (${region}) → HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body?.bundles)) throw new Error(`/bundle/list (${region}) → unexpected shape`);
  return body.bundles;
}

// Union over regions; a tool published in only one region is still published.
const published = new Map();
for (const r of REGIONS) for (const b of await fetchList(r)) if (!published.has(b.id)) published.set(b.id, b);
// An empty list is far more likely an outage than "everything was unpublished" — never wipe the repo on it.
if (published.size === 0) throw new Error("/bundle/list returned no tools; refusing to sync");

const changes = [];
const blocked = [];
const index = [];

for (const w of whitelist) {
  const b = published.get(w.id);
  if (!b) continue; // whitelisted but not published (yet / any more) → removed below
  const reviewed = new Set(w.network ?? []);
  const unreviewed = (b.network ?? []).filter((h) => !reviewed.has(h));
  const prev = prevById.get(w.id);
  if (unreviewed.length) {
    blocked.push(`${w.domain} v${b.version}: unreviewed host(s) ${unreviewed.join(", ")}`);
    if (prev) index.push(prev); // keep what we already have
    continue;
  }
  const entry = {
    id: b.id,
    domain: w.domain,
    version: b.version,
    title: b.title,
    titleEn: b.i18n?.["en-US"]?.title ?? b.title,
    subtitle: b.subtitle ?? "",
    subtitleEn: b.i18n?.["en-US"]?.subtitle ?? b.subtitle ?? "",
    category: b.category,
    kind: w.kind,
    network: b.network ?? [],
    sha256: b.sha256,
  };
  index.push(entry);
  const dir = join(TOOLS_DIR, w.domain);
  if (prev?.sha256 === b.sha256 && existsSync(dir)) continue;
  changes.push(prev ? `${w.domain} v${prev.version} → v${b.version}` : `${w.domain} v${b.version} (new)`);
  if (DRY) continue;

  const res = await fetch(b.bundleUrl);
  if (!res.ok) throw new Error(`${w.domain}: download → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = "sha256:" + createHash("sha256").update(buf).digest("hex");
  if (got !== b.sha256) throw new Error(`${w.domain}: sha256 mismatch (list ${b.sha256}, got ${got})`);
  const tmp = mkdtempSync(join(tmpdir(), "numable-tools-"));
  const zip = join(tmp, "b.xbundle");
  writeFileSync(zip, buf);
  const out = join(tmp, "out");
  execFileSync("unzip", ["-q", zip, "-d", out]);
  if (!existsSync(join(out, "manifest.json"))) throw new Error(`${w.domain}: archive has no manifest.json`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(TOOLS_DIR, { recursive: true });
  renameSync(out, dir);
  rmSync(tmp, { recursive: true, force: true });
}

// Remove anything that is not (whitelisted ∩ published).
const keep = new Set(index.map((t) => t.domain));
if (existsSync(TOOLS_DIR)) {
  for (const name of readdirSync(TOOLS_DIR)) {
    if (keep.has(name)) continue;
    changes.push(`${name} removed`);
    if (!DRY) rmSync(join(TOOLS_DIR, name), { recursive: true, force: true });
  }
}

index.sort((a, b) => a.domain.localeCompare(b.domain));

const KIND = {
  offline: "offline · 不联网",
  "public-api": "public API · 公开接口",
  "user-credential": "your own key · 用户自带凭证",
  "first-party": "Numable service · Numable 自家服务",
};
function table() {
  const rows = index.map(
    (t) => `| [${t.titleEn}](tools/${t.domain}) · ${t.title} | \`${t.domain}\` | ${t.version} | ${KIND[t.kind] ?? t.kind} | ${t.network.map((h) => `\`${h}\``).join(" ") || "—"} |`,
  );
  return ["| Tool · 工具 | Folder | Version | Data · 数据 | Hosts |", "|---|---|---|---|---|", ...rows].join("\n");
}

if (!DRY) {
  writeFileSync(join(ROOT, "index.json"), JSON.stringify({ tools: index }, null, 2) + "\n");
  const readmePath = join(ROOT, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const next = readme.replace(/<!-- tools:begin -->[\s\S]*<!-- tools:end -->/, `<!-- tools:begin -->\n${table()}\n<!-- tools:end -->`);
  if (next !== readme) writeFileSync(readmePath, next);
}

// Commit message for the workflow.
const summary = changes.length ? `sync: ${changes.join("; ")}` : "";
if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\n`, { flag: "a" });
console.log(changes.length ? changes.map((c) => `• ${c}`).join("\n") : "no changes");
if (blocked.length) {
  console.error(`\n✗ held back — review the new host(s), then add them to tools.json:\n${blocked.map((b) => `  • ${b}`).join("\n")}`);
  process.exit(1);
}
