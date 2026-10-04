// Checks every outbound https link in data/ answers with a non-error status.
// Usage: node tools/check-links.mjs
import { readFileSync } from "node:fs";

const text = ["challenges-2026.json", "datasets.json", "past.json"].map((f) => readFileSync(`data/${f}`, "utf8")).join("\n");
const urls = [...new Set(text.match(/https:\/\/[^\s"'<>)]+/g))].filter((u) => !u.includes("{"));
const UA = { "User-Agent": "Mozilla/5.0 (space-data-atlas link check; +https://github.com/swapniltamse/space-data-atlas)" };

async function check(u) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(u, { method, headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (r.status < 400) return r.status;
      if (method === "GET") return r.status;
    } catch (e) {
      if (method === "GET") return e.name === "TimeoutError" ? "timeout" : e.message;
    }
  }
}

let bad = 0;
const results = [];
for (let i = 0; i < urls.length; i += 8) {
  results.push(...(await Promise.all(urls.slice(i, i + 8).map(async (u) => [u, await check(u)]))));
}
for (const [u, s] of results) {
  const ok = typeof s === "number" && s < 400;
  // Some API roots answer 400/405 to a bare request but are live; flag them for a look rather than failing.
  const soft = typeof s === "number" && [400, 401, 403, 405, 422].includes(s);
  if (!ok && !soft) bad++;
  if (!ok) console.log(`${soft ? "warn" : "FAIL"} ${s} ${u}`);
}
console.log(`${urls.length - bad}/${urls.length} links OK (warnings are live hosts that refuse bare requests)`);
process.exit(bad ? 1 : 0);
