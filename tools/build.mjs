// Renders the static site from data/*.json into public/, and writes the
// data bundle the MCP function imports. Usage: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const challenges = read("challenges-2026.json");
const datasets = read("datasets.json");
const starters = read("starters.json");
const map = read("challenge-map.json");
const past = read("past.json");

const SITE = "https://spacedata.swapniltamse.com";
const REPO = "https://github.com/swapniltamse/space-data-atlas";
const DISCLAIMER =
  "Independent project. Not affiliated with, produced by, or endorsed by NASA or NASA Space Apps.";

const byId = Object.fromEntries(datasets.map((d) => [d.id, d]));
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

for (const c of challenges) {
  const m = map[c.slug];
  if (!m) throw new Error(`challenge-map.json is missing ${c.slug}`);
  Object.assign(c, m);
  c.past = past.winners.filter((w) => w.relatedTo.includes(c.slug));
}

const authLabel = { none: "No login", "api-key": "Free API key", "earthdata-login": "Earthdata Login" };
const authNote = {
  none: "Open to anyone, no account needed.",
  "api-key": "Needs a free key. Sign up takes a minute.",
  "earthdata-login": "Search is open. Downloading files needs a free Earthdata Login account.",
};

function badges(d) {
  const b = [`<span class="badge auth-${d.auth}" title="${esc(authNote[d.auth])}">${authLabel[d.auth]}</span>`];
  if (d.browserCors === true) b.push(`<span class="badge cors" title="Can be called straight from a web page">Works in browser</span>`);
  return b.join("");
}

function page({ path, title, description, body, noindex = false }) {
  const full = path === "/" ? "Space Data Atlas" : `${title} | Space Data Atlas`;
  const nav = [
    ["/challenges/", "Challenges"],
    ["/datasets/", "Datasets"],
    ["/starters/", "Starter code"],
    ["/past/", "Past winners"],
    ["/connect/", "Use with AI"],
  ]
    .map(([href, label]) => `<a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ""}>${label}</a>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${path}">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
<script>try{const t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <a class="wordmark" href="/"><svg aria-hidden="true" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 19c5-4 9 2 14-2s6-6 8-5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="22" cy="10" r="2.5" fill="currentColor"/></svg>Space Data Atlas</a>
  <nav aria-label="Main">${nav}</nav>
  <button class="theme" type="button" aria-label="Switch to dark theme" title="Switch theme"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><defs><clipPath id="earth-clip"><circle cx="16" cy="16" r="13"/></clipPath></defs><g clip-path="url(#earth-clip)"><rect class="ocean" width="32" height="32"/><path class="land" d="M6 10c2-3 6-4 8-2s0 4-2 5-1 4-3 4-4-1-4-3 0-2 1-4z M17 6c4-1 8 1 10 5-2 2-4 1-5 3s1 5-1 7-4 2-5 0 1-4 0-6-2-6 1-9z M10 21c2-1 4 0 4 2s-1 4-3 4-2-4-1-6z"/><path class="night" d="M15 0C10 9 10 23 15 32H44V0Z"/><g class="lights"><circle cx="21" cy="12" r=".9"/><circle cx="24" cy="15" r=".7"/><circle cx="20" cy="18" r=".8"/><circle cx="22" cy="21" r=".6"/><circle cx="13" cy="24" r=".7"/><circle cx="18" cy="9" r=".6"/></g></g><circle class="rim" cx="16" cy="16" r="13"/></svg></button>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <p>${DISCLAIMER} Challenge summaries are paraphrased; the official statements live on spaceappschallenge.org.</p>
  <p>Built by <a href="https://www.swapniltamse.com">Swapnil Tamse</a>. <a href="/about/">Why this exists</a>. Open source under MIT on <a href="${REPO}">GitHub</a>.</p>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

function datasetCard(d, compact = false) {
  return `<article class="ds" id="${d.id}" data-auth="${d.auth}" data-cors="${d.browserCors === true}" data-topics="${esc((d.topics || []).join(" "))}">
  <h3><a href="${esc(d.docsUrl)}">${esc(d.name)}</a></h3>
  <p class="provider">${esc(d.provider)}</p>
  <div class="badges">${badges(d)}</div>
  ${compact ? "" : `<p>${esc(d.description)}</p>`}
  ${accessLine(d)}
</article>`;
}

function accessLine(d) {
  const a = d.access || {};
  const bits = [];
  if (a.cmrShortName) bits.push(`CMR short name <code>${esc(a.cmrShortName)}</code>`);
  if (a.cmrConceptId) bits.push(`concept ID <code>${esc(a.cmrConceptId)}</code>`);
  if (a.gibsLayer) bits.push(`GIBS layer <code>${esc(a.gibsLayer)}</code>`);
  if (a.endpoint && !a.cmrConceptId) bits.push(`endpoint <code>${esc(a.endpoint)}</code>`);
  return bits.length ? `<p class="access">${bits.join(", ")}</p>` : "";
}

function starterBlock(s) {
  return `<figure class="starter">
  <figcaption><span>${esc(s.title)}</span><span class="lang">${s.lang === "python" ? "Python" : "JavaScript"}${s.needsLogin ? ", needs login or key" : ""}</span><button type="button" class="copy">Copy</button></figcaption>
  <pre><code>${esc(s.code)}</code></pre>
</figure>`;
}

// ---------- home ----------
function home() {
  const usedIds = [...new Set(challenges.flatMap((c) => c.datasetIds))];
  const ds = usedIds.map((id) => byId[id]);
  const rowH = 30, top = 20;
  const leftN = challenges.length, rightN = ds.length;
  const h = Math.max(leftN, rightN) * rowH + top * 2;
  const ly = (i) => top + (i + 0.5) * ((h - top * 2) / leftN);
  const ry = (i) => top + (i + 0.5) * ((h - top * 2) / rightN);
  const L = 330, R = 670;
  const links = challenges
    .flatMap((c, i) =>
      c.datasetIds.map((id) => {
        const j = usedIds.indexOf(id);
        return `<path data-c="${c.slug}" data-d="${id}" d="M${L} ${ly(i)} C ${(L + R) / 2} ${ly(i)}, ${(L + R) / 2} ${ry(j)}, ${R} ${ry(j)}"/>`;
      }),
    )
    .join("");
  const left = challenges
    .map(
      (c, i) =>
        `<a href="/challenges/${c.slug}/" data-c="${c.slug}"><text x="${L - 12}" y="${ly(i) + 4}" text-anchor="end">${esc(short(c.title))}</text><circle cx="${L}" cy="${ly(i)}" r="4"/></a>`,
    )
    .join("");
  const right = ds
    .map(
      (d, j) =>
        `<a href="/datasets/#${d.id}" data-d="${d.id}"><circle cx="${R}" cy="${ry(j)}" r="4"/><text x="${R + 12}" y="${ry(j) + 4}">${esc(clip(d.name, 44))}</text></a>`,
    )
    .join("");
  const list = challenges
    .map(
      (c) => `<li><a href="/challenges/${c.slug}/">${esc(c.title)}</a> <span class="muted">${c.datasetIds.length} datasets</span></li>`,
    )
    .join("");
  return page({
    path: "/",
    title: "Space Data Atlas",
    description:
      "Find the NASA data for every NASA Space Apps 2026 challenge: suggested datasets, how to access them, starter code, and related past winners.",
    body: `<section class="hero">
  <h1>Every 2026 Space Apps challenge, traced to the NASA data that can solve it.</h1>
  <p class="lede">Pick a challenge. See which datasets fit, whether they need a login, and code that runs in the first five minutes. Free, open source, and usable from your AI coding tool.</p>
  <form class="search" action="/challenges/" role="search"><label for="q">Search challenges and datasets</label><input id="q" name="q" type="search" placeholder="Try wildfire, Mars, soil, radar"><button>Search</button></form>
</section>
<section class="atlas" aria-labelledby="atlas-h">
  <h2 id="atlas-h">The map</h2>
  <p class="muted">Challenges on the left, the datasets suggested for them on the right. Hover or focus a challenge to trace its data.</p>
  <div class="atlas-wrap"><svg class="atlas-svg" viewBox="0 0 1000 ${h}" role="img" aria-label="Diagram linking ${leftN} challenges to ${rightN} datasets"><g class="links">${links}</g><g class="left">${left}</g><g class="right">${right}</g></svg></div>
  <ul class="atlas-list">${list}</ul>
</section>
<section class="three">
  <div><h2>Start with the problem</h2><p>Each challenge page lists suggested datasets in order of usefulness, what access each one needs, and three things to do in your first hour.</p><p><a href="/challenges/">Browse the 14 challenges</a></p></div>
  <div><h2>Skip the login maze</h2><p>Every dataset is marked by what it takes to reach it: nothing, a free API key, or a free Earthdata Login. Filter for data you can use right away.</p><p><a href="/datasets/">Open the dataset catalog</a></p></div>
  <div><h2>Ask from your editor</h2><p>Connect Claude Code, Cursor or any MCP client and ask for a challenge's data, starter code, or a live NASA catalog search without leaving your project.</p><p><a href="/connect/">Connect your AI tool</a></p></div>
</section>
<p class="note">Dataset suggestions are mine, made from the challenge summaries released September 17. The full statements and official resource lists arrive October 28, and this site will be updated to match.</p>`,
  });
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function short(s, n = 40) {
  s = s.replace(/^(Build a |Create |Identify |Be An |The )/, "").replace(/[:!].*$/, "");
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// ---------- challenges ----------
function challengeIndex() {
  const subjects = [...new Set(challenges.flatMap((c) => c.subjects))].sort();
  const levels = ["Beginner/Youth", "Intermediate", "Advanced"];
  const cards = challenges
    .map(
      (c) => `<li class="ch" data-levels="${esc(c.difficulty.join("|"))}" data-subjects="${esc(c.subjects.join("|"))}" data-text="${esc(
        (c.title + " " + c.summary + " " + c.datasetIds.map((id) => byId[id].name).join(" ")).toLowerCase(),
      )}">
  <h2><a href="/challenges/${c.slug}/">${esc(c.title)}</a></h2>
  <p>${esc(c.summary)}</p>
  <p class="meta">${esc(c.difficulty.join(", "))}. ${esc(c.subjects.join(", "))}.</p>
</li>`,
    )
    .join("");
  return page({
    path: "/challenges/",
    title: "Challenges",
    description: "All 14 NASA Space Apps 2026 challenges with the NASA datasets suggested for each.",
    body: `<h1>Challenges</h1>
<p class="lede">The 14 challenges for 2026. Filter by level or subject, or search by topic or dataset.</p>
<div class="filters" data-filter="challenges">
  <label>Search <input type="search" data-q placeholder="wildfire, Mars, radar"></label>
  <label>Level <select data-level><option value="">Any level</option>${levels.map((l) => `<option>${l}</option>`).join("")}</select></label>
  <label>Subject <select data-subject><option value="">Any subject</option>${subjects.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
</div>
<p class="count" aria-live="polite"></p>
<ul class="ch-list">${cards}</ul>`,
  });
}

function challengePage(c) {
  const ds = c.datasetIds.map((id) => byId[id]);
  const st = starters.filter((s) => c.datasetIds.includes(s.datasetId));
  // Single-file collections make a dull live demo, so prefer the next CMR dataset.
  const NO_DEMO = new Set(["grace-mascon"]);
  const firstCmr = ds.find((d) => d.access?.cmrConceptId && !NO_DEMO.has(d.id)) || ds.find((d) => d.access?.cmrConceptId);
  const tryIt = firstCmr
    ? `<section class="try" data-concept="${esc(firstCmr.access.cmrConceptId)}" data-name="${esc(firstCmr.name)}">
  <h2>Try a live search</h2>
  <p>Ask NASA's Common Metadata Repository for the five newest files in ${esc(firstCmr.name)}. This runs in your browser and needs no login.</p>
  <button type="button" class="run">Search NASA's catalog</button>
  <div class="try-out" aria-live="polite"></div>
</section>`
    : "";
  const pastHtml = c.past.length
    ? `<section><h2>Related 2025 winners</h2><p class="muted">Matched by theme. Study how they scoped the problem.</p><ul class="past">${c.past
        .map((w) => `<li><strong>${esc(w.team)}</strong> (${esc(w.location)}), ${esc(w.award)}, for "${esc(w.challenge)}"</li>`)
        .join("")}</ul><p><a href="${past.source.url}">NASA's 2025 winners announcement</a></p></section>`
    : "";
  return page({
    path: `/challenges/${c.slug}/`,
    title: c.title,
    description: `NASA datasets, access notes and starter code for the Space Apps 2026 challenge "${c.title}".`,
    body: `<p class="crumb"><a href="/challenges/">Challenges</a></p>
<h1>${esc(c.title)}</h1>
<p class="meta">${esc(c.difficulty.join(", "))}. ${esc(c.subjects.join(", "))}.</p>
<p class="lede">${esc(c.summary)}</p>
<p><a class="official" href="${esc(c.officialUrl)}">Read the official challenge on spaceappschallenge.org</a></p>
${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
${c.officialResources?.length ? `<section><h2>Official resources</h2><p class="muted">Listed in the full challenge statement.</p><ul class="past">${c.officialResources.map((r) => `<li><a href="${esc(r.url)}">${esc(r.title)}</a></li>`).join("")}</ul></section>` : ""}
<section><h2>Your first hour</h2><ol class="steps">${c.firstSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
<section><h2>Suggested datasets</h2><p class="muted">In order of how useful they are likely to be. These are suggestions, not the official resource list.</p><div class="ds-grid">${ds
      .map((d) => datasetCard(d))
      .join("")}</div></section>
${st.length ? `<section><h2>Starter code</h2>${st.map(starterBlock).join("")}</section>` : ""}
${tryIt}
${pastHtml}`,
  });
}

// ---------- datasets ----------
function datasetIndex() {
  const topics = [...new Set(datasets.flatMap((d) => d.topics || []))].sort();
  return page({
    path: "/datasets/",
    title: "Datasets",
    description: "A curated catalog of NASA datasets and APIs for Space Apps 2026, marked by what access each needs.",
    body: `<h1>Datasets</h1>
<p class="lede">${datasets.length} NASA datasets and APIs, each checked by hand on ${esc(datasets[0].checked)}. Every one says what it takes to get the data.</p>
<dl class="legend">
  <div><dt><span class="badge auth-none">No login</span></dt><dd>Open to anyone.</dd></div>
  <div><dt><span class="badge auth-api-key">Free API key</span></dt><dd>Sign up for a free key first.</dd></div>
  <div><dt><span class="badge auth-earthdata-login">Earthdata Login</span></dt><dd>Searching is open; downloading needs a free <a href="https://urs.earthdata.nasa.gov/users/new">Earthdata Login</a> account.</dd></div>
  <div><dt><span class="badge cors">Works in browser</span></dt><dd>Can be called straight from a web page.</dd></div>
</dl>
<div class="filters" data-filter="datasets">
  <label>Search <input type="search" data-q placeholder="fire, soil, Moon"></label>
  <label>Topic <select data-topic><option value="">Any topic</option>${topics.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
  <label class="check"><input type="checkbox" data-open> No login needed</label>
  <label class="check"><input type="checkbox" data-cors> Works in browser</label>
</div>
<p class="count" aria-live="polite"></p>
<div class="ds-grid">${datasets.map((d) => datasetCard(d)).join("")}</div>`,
  });
}

function startersPage() {
  return page({
    path: "/starters/",
    title: "Starter code",
    description: "Short, tested Python and JavaScript snippets for reaching NASA data.",
    body: `<h1>Starter code</h1>
<p class="lede">Short snippets that reach real NASA data. Each one that needs no login was run before publishing.</p>
<section><h2>Before you start</h2>
<ol class="steps">
<li>For Python, install the tools: <code>pip install earthaccess requests</code>.</li>
<li>If a dataset says Earthdata Login, create a free account at <a href="https://urs.earthdata.nasa.gov/users/new">urs.earthdata.nasa.gov</a>. You only need it to download files.</li>
<li>For a NASA API key, sign up at <a href="https://api.nasa.gov/">api.nasa.gov</a>. Keep it in an environment variable, never in code you push.</li>
</ol></section>
${datasets
  .filter((d) => starters.some((s) => s.datasetId === d.id))
  .map(
    (d) => `<section><h2 id="${d.id}">${esc(d.name)}</h2>${starters
      .filter((s) => s.datasetId === d.id)
      .map(starterBlock)
      .join("")}</section>`,
  )
  .join("")}`,
  });
}

function pastPage() {
  return page({
    path: "/past/",
    title: "Past winners",
    description: "NASA Space Apps 2025 global winners, linked to the 2026 challenges they resemble.",
    body: `<h1>Past winners</h1>
<p class="lede">The ten 2025 global winners, from <a href="${past.source.url}">NASA's announcement</a>. Each is linked to the 2026 challenges it most resembles, which is my judgment, not NASA's.</p>
<table class="past-table">
<thead><tr><th scope="col">Team</th><th scope="col">Award</th><th scope="col">2025 challenge</th><th scope="col">Similar 2026 challenges</th></tr></thead>
<tbody>${past.winners
      .map(
        (w) => `<tr><td><strong>${esc(w.team)}</strong><br><span class="muted">${esc(w.location)}</span></td><td>${esc(w.award)}</td><td>${esc(w.challenge)}</td><td>${w.relatedTo
          .map((s) => {
            const c = challenges.find((x) => x.slug === s);
            return `<a href="/challenges/${s}/">${esc(short(c.title, 60))}</a>`;
          })
          .join("<br>")}</td></tr>`,
      )
      .join("")}</tbody></table>`,
  });
}

function mcpPage() {
  return page({
    path: "/connect/",
    title: "Use with AI",
    description: "Connect Claude Code, Cursor or any MCP client to the Space Data Atlas index.",
    body: `<h1>Use it from your AI tool</h1>
<p class="lede">Space Data Atlas runs a free MCP server at <code>${SITE}/mcp</code>. Connect it once and your coding assistant can look up challenges, datasets and starter code, and search NASA's catalog live.</p>
<section><h2>Claude Code</h2><figure class="starter"><figcaption><span>Run in your terminal</span><button type="button" class="copy">Copy</button></figcaption><pre><code>claude mcp add --transport http spacedata ${SITE}/mcp</code></pre></figure>
<p>Then ask something like: "Use spacedata to get the datasets for the Dancing with the SARs challenge and write me a script that finds the newest files over Houston."</p></section>
<section><h2>Claude desktop and claude.ai</h2><p>Open Settings, then Connectors, then Add custom connector. Paste <code>${SITE}/mcp</code> as the URL. No sign-in is needed.</p></section>
<section><h2>Cursor and other clients</h2><figure class="starter"><figcaption><span>mcp.json</span><button type="button" class="copy">Copy</button></figcaption><pre><code>${esc(JSON.stringify({ mcpServers: { spacedata: { url: `${SITE}/mcp` } } }, null, 2))}</code></pre></figure></section>
<section><h2>What it can do</h2>
<dl class="tools">
<div><dt><code>list_challenges</code></dt><dd>List the 2026 challenges, optionally by level or subject.</dd></div>
<div><dt><code>get_challenge</code></dt><dd>One challenge with its suggested datasets, first steps, starter code and related winners.</dd></div>
<div><dt><code>find_datasets</code></dt><dd>Search the curated catalog by topic, with a filter for data that needs no login.</dd></div>
<div><dt><code>search_nasa_collections</code></dt><dd>Live keyword search of NASA's Common Metadata Repository, with optional area and dates. Returns up to 10 collections.</dd></div>
<div><dt><code>get_starter_code</code></dt><dd>Starter code for a dataset in Python or JavaScript.</dd></div>
</dl></section>
<p class="note">The server is read-only, keeps no logs of your questions, and needs no account. Live searches are sent to NASA's public CMR API.</p>`,
  });
}

function aboutPage() {
  return page({
    path: "/about/",
    title: "Why this exists",
    description: "Why Space Data Atlas was built and how it is maintained.",
    body: `<h1>Why this exists</h1>
<p class="lede">NASA publishes an enormous amount of open data. During a 48-hour hackathon, finding the right piece of it can eat the first half of the weekend.</p>
<p>Space Apps teams start from a problem: track surface change with radar, merge two fire records, map a route on Mars. The data lives across dozens of archives with different logins, formats and search tools. Space Data Atlas starts from the problem instead and works back to the data, so a team can spend its time building.</p>
<h2>How it is made</h2>
<p>Each challenge summary is paraphrased from the official page and links back to it. Each dataset was checked against NASA's live services on the date shown, and each starter snippet that needs no login was run before it was published. The suggestions are my own reading of the challenges, not the official resource lists, which arrive October 28.</p>
<h2>Who made it</h2>
<p>I'm <a href="https://www.swapniltamse.com">Swapnil Tamse</a>, an engineering leader in AI and AI security in New York. I also built <a href="https://moonbase.swapniltamse.com">Wiring the Moon</a>, an explainer of NASA's lunar communications plans. This one is a free resource for Space Apps teams. ${DISCLAIMER}</p>
<h2>Corrections</h2>
<p>Found a wrong link or a better dataset for a challenge? Open an issue on <a href="${REPO}/issues">GitHub</a>. The code and data are MIT licensed, so fork it for your own event.</p>`,
  });
}

function howItWorks() {
  return page({
    path: "/how-it-works/",
    title: "How it works",
    noindex: true,
    description: "How Space Data Atlas is built.",
    body: `<div class="doc"><h1>How it works</h1>
<p class="lede">A static site and a tiny MCP server, both generated from the same four JSON files.</p>
<h2>One source of truth</h2>
<p>Everything lives in <code>data/</code>: challenge summaries, the dataset catalog, starter snippets and the challenge-to-dataset map. <code>tools/build.mjs</code> renders every page from those files and writes the same data as a module for the MCP server, so a correction made once shows up on both the website and in every AI tool.</p>
<h2>Getting the challenges</h2>
<p>The Space Apps site renders its challenge pages with JavaScript, so a plain HTTP fetch sees an empty page. <code>tools/scrape-challenges.mjs</code> opens each page in headless Chromium with Playwright and saves the rendered text. Summaries are then paraphrased by hand. The scraper runs again when the full statements are released.</p>
<h2>Keeping data honest</h2>
<p><code>tools/check-cmr.mjs</code> asks NASA's Common Metadata Repository whether every collection ID still exists and still has files. <code>tools/validate.mjs</code> fails the build if any challenge points at a dataset that doesn't exist, or if any page is missing the independence disclaimer. Both run in GitHub Actions on every push.</p>
<h2>The MCP server</h2>
<p>A Cloudflare Pages Function at <code>/mcp</code> speaks the Model Context Protocol's Streamable HTTP transport in stateless JSON mode. It has no SDK dependency: about two hundred lines handle <code>initialize</code>, <code>tools/list</code> and <code>tools/call</code>. Four tools read the bundled data; one forwards a capped keyword search to CMR with a <code>Client-Id</code> header so NASA can see where the traffic comes from. No API keys exist anywhere in the system, so there is nothing to leak and no shared quota to exhaust.</p>
<h2>Design</h2>
<p>The look borrows from survey maps: cool paper, ink, and a single route blue for the lines that connect a challenge to its data. The home page diagram is the product itself drawn as a map rather than decoration. Headings are set in Bricolage Grotesque and body text in Atkinson Hyperlegible, a face designed by the Braille Institute for legibility. Code uses JetBrains Mono, and only code. There are two interactive motions: lines light up when you point at a challenge, and the theme switch is a small Earth whose night side slides across, city lights coming on, when you choose dark mode. Both are switched off for people who ask their system for reduced motion.</p>
<h2>Trade-offs</h2>
<p>No framework and no build step beyond one script, so the site loads fast and anyone can fork it in an afternoon. No accounts or team features, which keeps it safe to run unattended during the event. The cost is that dataset matching is hand-curated, which is also the point: that judgment is what a search box can't give you.</p></div>`,
  });
}

// ---------- write ----------
rmSync(new URL("../public", import.meta.url), { recursive: true, force: true });
const out = (p, html) => {
  const dir = new URL(`../public${p}`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL("index.html", dir), html);
};
cpSync(new URL("../assets", import.meta.url), new URL("../public/assets", import.meta.url), { recursive: true });
out("/", home());
out("/challenges/", challengeIndex());
challenges.forEach((c) => out(`/challenges/${c.slug}/`, challengePage(c)));
out("/datasets/", datasetIndex());
out("/starters/", startersPage());
out("/past/", pastPage());
out("/connect/", mcpPage());
out("/about/", aboutPage());
out("/how-it-works/", howItWorks());

const notFound = page({
  path: "/404",
  title: "Not found",
  noindex: true,
  description: "Page not found.",
  body: `<h1>That page isn't on the map.</h1><p class="lede">It may have moved when the full challenge statements came out. Try the <a href="/challenges/">challenge list</a> or the <a href="/datasets/">dataset catalog</a>.</p>`,
});
writeFileSync(new URL("../public/404.html", import.meta.url), notFound);

const urls = ["/", "/challenges/", ...challenges.map((c) => `/challenges/${c.slug}/`), "/datasets/", "/starters/", "/past/", "/connect/", "/about/"];
writeFileSync(
  new URL("../public/sitemap.xml", import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join("")}</urlset>\n`,
);
writeFileSync(new URL("../public/robots.txt", import.meta.url), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
// Only /mcp runs as a Function; every other path is served straight from static assets.
writeFileSync(new URL("../public/_routes.json", import.meta.url), JSON.stringify({ version: 1, include: ["/mcp"], exclude: [] }));
writeFileSync(
  new URL("../public/_headers", import.meta.url),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`,
);

// Data bundle for the MCP function and for anyone who wants the raw data.
const bundle = { challenges, datasets, starters, past, disclaimer: DISCLAIMER, site: SITE };
mkdirSync(new URL("../functions/_lib", import.meta.url), { recursive: true });
writeFileSync(new URL("../functions/_lib/data.js", import.meta.url), `export default ${JSON.stringify(bundle)};\n`);
writeFileSync(new URL("../public/atlas.json", import.meta.url), JSON.stringify(bundle, null, 2));
console.log(`built ${urls.length + 1} pages, ${datasets.length} datasets, ${starters.length} starters`);
