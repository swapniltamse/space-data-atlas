// Schema and integrity checks for data/, plus a disclaimer check on built pages.
// Usage: node tools/validate.mjs   (run tools/build.mjs first for the page checks)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const read = (f) => JSON.parse(readFileSync(`data/${f}`, "utf8"));
const errors = [];
const fail = (m) => errors.push(m);

const Url = z.string().url().refine((u) => u.startsWith("https://"), "must be https");
const Challenge = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(5), officialUrl: Url,
  difficulty: z.array(z.enum(["Beginner/Youth", "Intermediate", "Advanced"])).min(1),
  subjects: z.array(z.string()).min(1), summary: z.string().min(40).max(320),
});
const Dataset = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string(), provider: z.string(), description: z.string().min(30),
  access: z.object({
    type: z.enum(["cmr", "api", "tiles", "tap", "download", "web"]),
    endpoint: Url.optional(), cmrShortName: z.string().optional(),
    cmrConceptId: z.string().regex(/^C\d+-[A-Z0-9_]+$/).optional(), gibsLayer: z.string().optional(),
  }).passthrough(),
  auth: z.enum(["none", "api-key", "earthdata-login"]), browserCors: z.boolean().nullable(),
  formats: z.array(z.string()), docsUrl: Url, topics: z.array(z.string()), checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).passthrough();
const Starter = z.object({
  id: z.string(), datasetId: z.string(), lang: z.enum(["python", "javascript"]), title: z.string(),
  runsIn: z.enum(["browser", "node", "python"]), needsLogin: z.boolean(), code: z.string().min(20),
}).passthrough();
const MapEntry = z.object({ datasetIds: z.array(z.string()).min(1).max(6), firstSteps: z.array(z.string()).length(3), note: z.string().optional() }).passthrough();

const parse = (schema, items, label) =>
  items.forEach((x, i) => {
    const r = schema.safeParse(x);
    if (!r.success) fail(`${label}[${i}] ${x.id || x.slug || ""}: ${r.error.issues.map((e) => `${e.path.join(".")} ${e.message}`).join("; ")}`);
  });

const challenges = read("challenges-2026.json");
const datasets = read("datasets.json");
const starters = read("starters.json");
const map = read("challenge-map.json");
const past = read("past.json");

parse(Challenge, challenges, "challenges");
parse(Dataset, datasets, "datasets");
parse(Starter, starters, "starters");
Object.entries(map).forEach(([k, v]) => parse(MapEntry, [v], `challenge-map.${k}`));

const ids = new Set(datasets.map((d) => d.id));
const slugs = new Set(challenges.map((c) => c.slug));
if (ids.size !== datasets.length) fail("duplicate dataset ids");
if (slugs.size !== challenges.length) fail("duplicate challenge slugs");
for (const s of slugs) if (!map[s]) fail(`challenge-map missing ${s}`);
for (const [s, m] of Object.entries(map)) {
  if (!slugs.has(s)) fail(`challenge-map has unknown slug ${s}`);
  for (const id of m.datasetIds) if (!ids.has(id)) fail(`challenge-map.${s} -> unknown dataset ${id}`);
}
for (const s of starters) if (!ids.has(s.datasetId)) fail(`starter ${s.id} -> unknown dataset ${s.datasetId}`);
for (const d of datasets) if (d.access.type === "cmr" && !d.access.cmrConceptId) fail(`dataset ${d.id} is type cmr but has no cmrConceptId`);
for (const w of past.winners) for (const s of w.relatedTo) if (!slugs.has(s)) fail(`past ${w.id} -> unknown challenge ${s}`);
const unused = [...ids].filter((id) => !Object.values(map).some((m) => m.datasetIds.includes(id)));

// Built pages: disclaimer on every page, no NASA insignia files.
let pages = 0;
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".html")) {
      pages++;
      const html = readFileSync(p, "utf8");
      if (!html.includes("Not affiliated with, produced by, or endorsed by NASA")) fail(`${p} is missing the disclaimer`);
      if (/meatball|nasa[-_]?logo|insignia\.(svg|png)/i.test(html)) fail(`${p} references a NASA logo`);
    }
  }
};
if (existsSync("public")) walk("public");
else fail("public/ not built; run node tools/build.mjs first");

console.log(`challenges ${challenges.length}, datasets ${datasets.length} (${unused.length} not mapped to a challenge), starters ${starters.length}, past winners ${past.winners.length}, pages checked ${pages}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("validate: OK");
