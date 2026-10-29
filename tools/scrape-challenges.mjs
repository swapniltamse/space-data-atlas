// Renders the Space Apps challenge pages (they are JavaScript-only) and writes
// a raw dump to data/raw/ for manual curation. Not used at build time.
// Usage: node tools/scrape-challenges.mjs [year]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const year = process.argv[2] || "2026";
const base = "https://www.spaceappschallenge.org";
mkdirSync("data/raw", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const apiHits = [];
page.on("response", async (r) => {
  const ct = r.headers()["content-type"] || "";
  if (ct.includes("json") && r.url().includes("spaceapps")) {
    try { apiHits.push({ url: r.url(), body: await r.json() }); } catch {}
  }
});

await page.goto(`${base}/${year}/challenges/`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const links = [...new Set(await page.$$eval(`a[href*="/${year}/challenges/"]`, (as) => as.map((a) => a.href)))]
  .filter((h) => !h.replace(/\/$/, "").endsWith("/challenges"));
console.log(`found ${links.length} challenge links`);

const challenges = [];
for (const url of links) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    const resources = [...main.querySelectorAll("a[href]")]
      .map((a) => ({ text: a.textContent.trim().replace(/\s+/g, " "), href: a.href }))
      .filter((l) => l.text && !l.href.includes("spaceappschallenge.org"));
    return { title: document.querySelector("h1")?.textContent.trim(), text: main.innerText, resources };
  });
  // Full statements keep their data links on a separate Resources tab.
  let resourcesText = "";
  let resourceLinks = [];
  const tab = page.locator('li[role="tab"]', { hasText: /^Resources$/ });
  if (await tab.count()) {
    await tab.first().click();
    await page.waitForTimeout(1500);
    ({ resourcesText, resourceLinks } = await page.evaluate(() => {
      const panel = document.querySelector('.react-tabs__tab-panel--selected') || document.querySelector("main");
      const resourceLinks = [...panel.querySelectorAll("a[href]")]
        .map((a) => ({ text: a.textContent.trim().replace(/\s+/g, " "), href: a.href }))
        .filter((l) => l.text && !l.href.includes("spaceappschallenge.org"));
      return { resourcesText: panel.innerText, resourceLinks };
    }));
  }
  challenges.push({ url, ...data, resourcesText, resourceLinks });
  console.log(`  ${data.title} (${resourceLinks.length} resource links)`);
}

writeFileSync(`data/raw/challenges-${year}.json`, JSON.stringify(challenges, null, 2));
writeFileSync(`data/raw/api-${year}.json`, JSON.stringify(apiHits, null, 2));
await browser.close();
