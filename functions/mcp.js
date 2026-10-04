// MCP server (Streamable HTTP, stateless JSON responses) as a Cloudflare Pages Function.
// Read-only: four tools over the bundled atlas data, one capped proxy to NASA CMR.
import atlas from "./_lib/data.js";

const SERVER = { name: "space-data-atlas", version: "1.0.0" };
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const CMR = "https://cmr.earthdata.nasa.gov/search";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const byId = Object.fromEntries(atlas.datasets.map((d) => [d.id, d]));
const slim = (d) => ({ id: d.id, name: d.name, provider: d.provider, auth: d.auth, browserCors: d.browserCors, access: d.access, docsUrl: d.docsUrl });

const TOOLS = [
  {
    name: "list_challenges",
    description: "List the 14 NASA Space Apps 2026 challenges with slug, title, level, subjects and a one-line summary. Optionally filter by level (Beginner/Youth, Intermediate, Advanced) or subject.",
    inputSchema: { type: "object", properties: { level: { type: "string" }, subject: { type: "string" } } },
    run({ level, subject } = {}) {
      return atlas.challenges
        .filter((c) => !level || c.difficulty.some((d) => d.toLowerCase() === level.toLowerCase()))
        .filter((c) => !subject || c.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase())))
        .map((c) => ({ slug: c.slug, title: c.title, difficulty: c.difficulty, subjects: c.subjects, summary: c.summary }));
    },
  },
  {
    name: "get_challenge",
    description: "Get one Space Apps 2026 challenge by slug (from list_challenges): summary, official URL, first-hour steps, suggested datasets in priority order with access details, starter code, and related 2025 winners.",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
    run({ slug }) {
      const c = atlas.challenges.find((x) => x.slug === slug || x.slug === String(slug).toLowerCase().trim());
      if (!c) throw new UserError(`No challenge with slug "${slug}". Call list_challenges for valid slugs.`);
      return {
        ...c,
        datasets: c.datasetIds.map((id) => ({ ...slim(byId[id]), description: byId[id].description })),
        starters: atlas.starters.filter((s) => c.datasetIds.includes(s.datasetId)),
        page: `${atlas.site}/challenges/${c.slug}/`,
        caveat: "Dataset suggestions are curated from the challenge summaries, not the official resource list.",
      };
    },
  },
  {
    name: "find_datasets",
    description: "Search the curated catalog of NASA datasets and APIs by keyword (matches name, description, provider and topics). Set noLoginOnly to return only data that needs no account.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, noLoginOnly: { type: "boolean" } }, required: ["query"] },
    run({ query, noLoginOnly }) {
      const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
      const scored = atlas.datasets
        .filter((d) => !noLoginOnly || d.auth === "none")
        .map((d) => {
          // Name and topic matches outrank a passing mention in the description.
          const name = d.name.toLowerCase(), topics = (d.topics || []).join(" ").toLowerCase();
          const rest = `${d.description} ${d.provider}`.toLowerCase();
          const score = terms.reduce((s, t) => s + (name.includes(t) ? 3 : 0) + (topics.includes(t) ? 2 : 0) + (rest.includes(t) ? 1 : 0), 0);
          return { d, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, 15).map(({ d }) => ({ ...slim(d), description: d.description }));
    },
  },
  {
    name: "search_nasa_collections",
    description: "Live keyword search of NASA's Common Metadata Repository (CMR) for Earth science collections. Optional boundingBox as 'west,south,east,north' in degrees and start/end dates as YYYY-MM-DD. Returns up to 10 collections with concept IDs you can pass to earthaccess.",
    inputSchema: {
      type: "object",
      properties: { keyword: { type: "string" }, boundingBox: { type: "string" }, start: { type: "string" }, end: { type: "string" } },
      required: ["keyword"],
    },
    async run({ keyword, boundingBox, start, end }) {
      const p = new URLSearchParams({ keyword: String(keyword).slice(0, 200), page_size: "10", sort_key: "-usage_score" });
      if (boundingBox) {
        const n = boundingBox.split(",").map(Number);
        if (n.length !== 4 || n.some(Number.isNaN)) throw new UserError("boundingBox must be 'west,south,east,north', for example '-95.8,29.5,-95.0,30.1'.");
        p.set("bounding_box", n.join(","));
      }
      const dateOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
      if ((start && !dateOk(start)) || (end && !dateOk(end))) throw new UserError("start and end must be YYYY-MM-DD.");
      if (start || end) p.set("temporal", `${start ? start + "T00:00:00Z" : ""},${end ? end + "T23:59:59Z" : ""}`);
      const r = await fetch(`${CMR}/collections.json?${p}`, { headers: { "Client-Id": "space-data-atlas" } });
      if (!r.ok) throw new UserError(`NASA CMR returned HTTP ${r.status}. Try again shortly or simplify the query.`);
      const entries = (await r.json()).feed?.entry || [];
      return {
        totalHits: Number(r.headers.get("CMR-Hits") || entries.length),
        collections: entries.map((e) => ({
          conceptId: e.id, shortName: e.short_name, version: e.version_id, title: e.title,
          provider: e.data_center, timeStart: e.time_start, timeEnd: e.time_end || null,
          cloudHosted: !!e.cloud_hosted, onlineAccess: !!e.online_access_flag,
        })),
        nextStep: "In Python: earthaccess.search_data(concept_id=<conceptId>, bounding_box=..., temporal=..., count=5). Downloads need a free Earthdata Login.",
      };
    },
  },
  {
    name: "get_starter_code",
    description: "Get tested starter code for a dataset id (from get_challenge or find_datasets). Optional lang: python or javascript.",
    inputSchema: { type: "object", properties: { datasetId: { type: "string" }, lang: { type: "string", enum: ["python", "javascript"] } }, required: ["datasetId"] },
    run({ datasetId, lang }) {
      if (!byId[datasetId]) throw new UserError(`Unknown datasetId "${datasetId}". Use find_datasets to look one up.`);
      const s = atlas.starters.filter((x) => x.datasetId === datasetId && (!lang || x.lang === lang));
      if (!s.length) return { datasetId, starters: [], hint: "No snippet for this dataset yet. Use its access details and docsUrl.", dataset: slim(byId[datasetId]) };
      return { datasetId, starters: s };
    },
  },
];

class UserError extends Error {}

// Per-isolate soft rate limit: 60 calls per minute per IP.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 60_000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 60;
}

const json = (body, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(msg) {
  const { id, method, params = {} } = msg || {};
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return rpcError(id, -32600, "Invalid request");
  if (id === undefined) return null; // notification, e.g. notifications/initialized
  switch (method) {
    case "initialize": {
      const v = PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0];
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: v,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: `Space Data Atlas maps NASA Space Apps 2026 challenges to NASA datasets. Start with list_challenges, then get_challenge. ${atlas.disclaimer}`,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: name === "search_nasa_collections" } })) } };
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const out = await tool.run(params.arguments || {});
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } };
      } catch (e) {
        const text = e instanceof UserError ? e.message : "The tool failed unexpectedly. Try again.";
        return { jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text }] } };
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST")
    return new Response("This is an MCP endpoint. Connect with an MCP client using the Streamable HTTP transport. Setup: https://spacedata.swapniltamse.com/connect/\n", {
      status: 405, headers: { Allow: "POST, OPTIONS", "Content-Type": "text/plain", ...CORS },
    });
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  let body;
  try { body = await request.json(); } catch { return json(rpcError(null, -32700, "Parse error"), 400); }
  // Every message in a batch counts toward the limit, so a batch can't multiply outbound CMR calls.
  const msgs = Array.isArray(body) ? body : [body];
  if (msgs.length > 10) return json(rpcError(null, -32600, "Batches are limited to 10 messages."), 400);
  if (msgs.map(() => limited(ip)).some(Boolean)) return json(rpcError(null, -32000, "Rate limit: 60 calls per minute. Slow down and retry."), 429);
  if (Array.isArray(body)) {
    const res = [];
    for (const m of body) { const r = await handle(m); if (r) res.push(r); } // sequential, not fanned out
    return res.length ? json(res) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await handle(body);
  return res ? json(res) : new Response(null, { status: 202, headers: CORS });
}
