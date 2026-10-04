# Space Data Atlas

Every NASA Space Apps 2026 challenge, traced to the NASA data that can solve it.

**Site:** https://spacedata.swapniltamse.com
**MCP server:** `https://spacedata.swapniltamse.com/mcp`

For each of the 14 challenges you get suggested datasets in order of usefulness, what access each one needs (nothing, a free API key, or a free Earthdata Login), starter code that runs, a live search of NASA's catalog, and related 2025 global winners.

Independent project. Not affiliated with, produced by, or endorsed by NASA or NASA Space Apps. Challenge summaries are paraphrased and link to the official statements on spaceappschallenge.org. Dataset suggestions are curated, not the official resource lists.

## Use it from your AI tool

```
claude mcp add --transport http spacedata https://spacedata.swapniltamse.com/mcp
```

Tools: `list_challenges`, `get_challenge`, `find_datasets`, `search_nasa_collections` (live CMR), `get_starter_code`. Read-only, no account, no API keys.

## Run it locally

```
npm install
npm run dev            # builds, then serves site + /mcp on http://127.0.0.1:8788
npm run test:mcp       # MCP end-to-end against the local server
npm run test:smoke     # every page at 1280px and 375px
```

## Data

Everything lives in `data/` and every page and the MCP server are generated from it.

| File | What it holds |
|---|---|
| `challenges-2026.json` | Slug, title, official link, level, subjects, paraphrased summary |
| `datasets.json` | Curated datasets and APIs with access type, auth, browser CORS, CMR concept IDs |
| `starters.json` | Short Python and JavaScript snippets, run before publishing |
| `challenge-map.json` | Which datasets fit each challenge, plus first-hour steps |
| `past.json` | 2025 global winners from NASA's announcement, matched to 2026 challenges by theme |

Checks: `npm run validate` (schemas, cross-references, disclaimer on every page), `npm run check:cmr` (every concept ID still has files), `npm run check:links`.

## Corrections

Wrong link, stale dataset, or a better fit for a challenge? Open an issue or a pull request against `data/`.

## License

Code and data: MIT. NASA data accessed through this site is subject to NASA's own data and media usage guidelines.
