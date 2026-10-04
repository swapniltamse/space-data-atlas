# Space Data Atlas

Static site + MCP server for NASA Space Apps 2026. Public repo (MIT): short, human commit messages.

- Source of truth is `data/`. Never hand-edit `public/` or `functions/_lib/data.js`; run `npm run build`.
- Deploy: `npm run deploy` (Cloudflare Pages project `space-data-atlas`, account stamsepublic). Custom domain spacedata.swapniltamse.com via Route 53 CNAME to space-data-atlas.pages.dev.
- `public/_routes.json` limits Functions to `/mcp`. The human setup page is `/connect/` because a page at `/mcp/` would collide with the function.
- Brand rules: no NASA or Space Apps logos, disclaimer on every page (validate enforces it), challenge text paraphrased with a link.
- Free and non-commercial. No ads, sponsors or donations.
- Oct 28, 2026: full statements release. Run `npm run scrape`, update summaries and `challenge-map.json`, rebuild, deploy.
