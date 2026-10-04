// Loads every page at desktop and phone widths against a running server.
// Checks: HTTP 200, no console errors, no horizontal scroll, disclaimer visible.
// Also runs the live CMR search on one challenge page and the map hover on home.
// Usage: BASE=http://127.0.0.1:8788 node tests/smoke.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8788";
const challenges = JSON.parse(readFileSync("data/challenges-2026.json", "utf8"));
const paths = ["/", "/challenges/", ...challenges.map((c) => `/challenges/${c.slug}/`), "/datasets/", "/starters/", "/past/", "/connect/", "/about/", "/how-it-works/"];
const browser = await chromium.launch();
let failures = 0;
const fail = (m) => { failures++; console.log("FAIL", m); };

for (const [w, h] of [[1280, 900], [375, 812]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(e.message));
  for (const p of paths) {
    errs.length = 0;
    const r = await page.goto(BASE + p, { waitUntil: "networkidle" });
    if (r.status() !== 200) fail(`${w}px ${p} status ${r.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) fail(`${w}px ${p} scrolls sideways by ${overflow}px`);
    if (!(await page.getByText("Not affiliated with, produced by, or endorsed by NASA").first().isVisible())) fail(`${w}px ${p} disclaimer not visible`);
    const real = errs.filter((e) => !/fonts\.g/.test(e));
    if (real.length) fail(`${w}px ${p} console: ${real.join(" | ")}`);
  }
  await page.close();
}

// Map interaction and filter on desktop.
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.hover(".atlas-svg .left a >> nth=0");
const lit = await page.$$eval(".atlas-svg path.on", (n) => n.length);
if (!lit) fail("map hover lit no paths"); else console.log(`map hover lit ${lit} paths`);
await page.screenshot({ path: "tests/out-home.png", fullPage: true });

await page.goto(BASE + "/datasets/?q=fire", { waitUntil: "networkidle" });
console.log("dataset filter:", await page.textContent(".count"));

// Live CMR search.
for (const c of challenges) {
  await page.goto(`${BASE}/challenges/${c.slug}/`, { waitUntil: "networkidle" });
  if (await page.$(".try")) {
    await page.click(".try .run");
    await page.waitForSelector(".try-out ol, .try-out:has-text(\"didn't\")", { timeout: 20000 });
    const out = await page.textContent(".try-out");
    if (!/newest|single file/.test(out)) fail(`live search on ${c.slug}: ${out}`);
    else console.log(`live search on ${c.slug}: ${out.slice(0, 90)}...`);
    await page.screenshot({ path: "tests/out-challenge.png", fullPage: true });
    break;
  }
}
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: "tests/out-home-mobile.png", fullPage: true });

await browser.close();
console.log(failures ? `\nsmoke: ${failures} failure(s)` : `\nsmoke: OK (${paths.length} pages x 2 widths)`);
process.exit(failures ? 1 : 0);
