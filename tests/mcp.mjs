// End-to-end check of the MCP endpoint over plain HTTP JSON-RPC.
// Usage: MCP=http://127.0.0.1:8788/mcp node tests/mcp.mjs
const MCP = process.env.MCP || "http://127.0.0.1:8788/mcp";
let n = 0, failures = 0;
const rpc = async (method, params) => {
  const r = await fetch(MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }),
  });
  return r.json();
};
const check = (label, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`); };
const text = (res) => res.result?.content?.[0]?.text || "";

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
check("initialize", init.result?.serverInfo?.name === "space-data-atlas", init.result?.protocolVersion);
const note = await fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
check("notification returns 202", note.status === 202, String(note.status));
const list = await rpc("tools/list");
check("tools/list", list.result?.tools?.length === 5, list.result?.tools?.map((t) => t.name).join(", "));
const lc = JSON.parse(text(await rpc("tools/call", { name: "list_challenges", arguments: {} })));
check("list_challenges", lc.length === 14, `${lc.length} challenges`);
const gc = JSON.parse(text(await rpc("tools/call", { name: "get_challenge", arguments: { slug: "dancing-with-the-sars" } })));
check("get_challenge", gc.datasets?.length > 0, gc.datasets?.map((d) => d.id).join(", "));
const fd = JSON.parse(text(await rpc("tools/call", { name: "find_datasets", arguments: { query: "fire" } })));
check("find_datasets fire", fd.length > 0, fd.slice(0, 3).map((d) => d.id).join(", "));
const sn = JSON.parse(text(await rpc("tools/call", { name: "search_nasa_collections", arguments: { keyword: "soil moisture", start: "2025-01-01", end: "2025-12-31" } })));
check("search_nasa_collections (live CMR)", sn.collections?.length > 0, `${sn.totalHits} hits, first ${sn.collections?.[0]?.shortName}`);
const firstStarterDs = gc.starters?.[0]?.datasetId || fd[0]?.id;
const sc = JSON.parse(text(await rpc("tools/call", { name: "get_starter_code", arguments: { datasetId: firstStarterDs } })));
check("get_starter_code", Array.isArray(sc.starters), `${sc.starters?.length} for ${firstStarterDs}`);
const bad = await rpc("tools/call", { name: "get_challenge", arguments: { slug: "nope" } });
check("bad slug returns isError", bad.result?.isError === true, text(bad));
const badBox = await rpc("tools/call", { name: "search_nasa_collections", arguments: { keyword: "x", boundingBox: "1,2" } });
check("bad bbox returns isError", badBox.result?.isError === true);
const batch = (k) => fetch(MCP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Array.from({ length: k }, (_, i) => ({ jsonrpc: "2.0", id: 100 + i, method: "ping" }))) });
const b2 = await batch(2);
check("batch of 2 answered", b2.status === 200 && (await b2.json()).length === 2);
const b11 = await batch(11);
check("batch over 10 rejected", b11.status === 400, String(b11.status));
const get = await fetch(MCP);
check("GET returns 405", get.status === 405);
console.log(failures ? `\nmcp: ${failures} failure(s)` : "\nmcp: OK");
process.exit(failures ? 1 : 0);
