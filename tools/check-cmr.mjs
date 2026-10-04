// Confirms every CMR concept ID still resolves and still has granules.
// Usage: node tools/check-cmr.mjs
import { readFileSync } from "node:fs";

const datasets = JSON.parse(readFileSync("data/datasets.json", "utf8")).filter((d) => d.access?.cmrConceptId);
const H = { headers: { "Client-Id": "space-data-atlas" } };
let bad = 0;
for (const d of datasets) {
  const id = d.access.cmrConceptId;
  try {
    const c = await fetch(`https://cmr.earthdata.nasa.gov/search/collections.json?concept_id=${id}`, H);
    const found = ((await c.json()).feed?.entry || []).length;
    const g = await fetch(`https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=${id}&page_size=0`, H);
    const hits = Number(g.headers.get("CMR-Hits") || 0);
    const ok = found === 1 && hits > 0;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${id.padEnd(24)} granules ${String(hits).padStart(10)}  ${d.id}`);
  } catch (e) {
    bad++;
    console.log(`FAIL ${id} ${d.id}: ${e.message}`);
  }
}
console.log(`\n${datasets.length - bad}/${datasets.length} CMR collections verified`);
process.exit(bad ? 1 : 0);
