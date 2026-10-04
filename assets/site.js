// Theme toggle, map highlighting, list filters, copy buttons, live CMR search.
(() => {
  const root = document.documentElement;
  document.querySelector(".theme")?.addEventListener("click", () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  // Map: light up a challenge's links, or a dataset's links.
  const svg = document.querySelector(".atlas-svg");
  if (svg) {
    const clear = () => {
      svg.classList.remove("lit");
      svg.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
    };
    const light = (attr, key) => {
      clear();
      svg.classList.add("lit");
      svg.querySelectorAll(`path[data-${attr}="${key}"]`).forEach((p) => {
        p.classList.add("on");
        svg.querySelector(`a[data-c="${p.dataset.c}"]`)?.classList.add("on");
        svg.querySelector(`a[data-d="${p.dataset.d}"]`)?.classList.add("on");
      });
    };
    svg.querySelectorAll("a[data-c], a[data-d]").forEach((a) => {
      const [attr, key] = a.dataset.c ? ["c", a.dataset.c] : ["d", a.dataset.d];
      a.addEventListener("mouseenter", () => light(attr, key));
      a.addEventListener("focus", () => light(attr, key));
      a.addEventListener("mouseleave", clear);
      a.addEventListener("blur", clear);
    });
  }

  // Filters on the challenge and dataset lists.
  const f = document.querySelector(".filters");
  if (f) {
    const isCh = f.dataset.filter === "challenges";
    const items = [...document.querySelectorAll(isCh ? ".ch" : ".ds")];
    const q = f.querySelector("[data-q]");
    const count = document.querySelector(".count");
    const params = new URLSearchParams(location.search);
    if (params.get("q")) q.value = params.get("q");
    const run = () => {
      const terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const el of items) {
        const text = (el.dataset.text || el.textContent + " " + el.dataset.topics).toLowerCase();
        let ok = terms.every((t) => text.includes(t));
        if (isCh) {
          const lv = f.querySelector("[data-level]").value, sj = f.querySelector("[data-subject]").value;
          if (lv && !el.dataset.levels.split("|").includes(lv)) ok = false;
          if (sj && !el.dataset.subjects.split("|").includes(sj)) ok = false;
        } else {
          const tp = f.querySelector("[data-topic]").value;
          if (tp && !el.dataset.topics.split(" ").includes(tp)) ok = false;
          if (f.querySelector("[data-open]").checked && el.dataset.auth !== "none") ok = false;
          if (f.querySelector("[data-cors]").checked && el.dataset.cors !== "true") ok = false;
        }
        el.hidden = !ok;
        if (ok) shown++;
      }
      count.textContent = shown === items.length
        ? `Showing all ${items.length}.`
        : shown ? `Showing ${shown} of ${items.length}.` : "Nothing matches. Clear a filter or try a broader word.";
    };
    f.addEventListener("input", run);
    run();
  }

  // Copy buttons.
  document.querySelectorAll(".copy").forEach((b) =>
    b.addEventListener("click", async () => {
      const code = b.closest("figure").querySelector("code").textContent;
      try { await navigator.clipboard.writeText(code); b.textContent = "Copied"; }
      catch { b.textContent = "Select and copy"; }
      setTimeout(() => (b.textContent = "Copy"), 1800);
    }),
  );

  // Live CMR search on challenge pages.
  const tryBox = document.querySelector(".try");
  if (tryBox) {
    const out = tryBox.querySelector(".try-out");
    const btn = tryBox.querySelector(".run");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      out.textContent = "Searching NASA's catalog...";
      try {
        const url = `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=${encodeURIComponent(tryBox.dataset.concept)}&sort_key=-start_date&page_size=5`;
        const r = await fetch(url, { headers: { "Client-Id": "space-data-atlas" } });
        if (!r.ok) throw new Error(`NASA's catalog answered ${r.status}`);
        const entries = (await r.json()).feed.entry || [];
        if (!entries.length) { out.textContent = "The catalog returned no files for this collection right now."; return; }
        const ol = document.createElement("ol");
        for (const e of entries) {
          const li = document.createElement("li");
          const when = (e.time_start || "").slice(0, 10);
          li.textContent = `${e.producer_granule_id || e.title}${when ? ` (${when})` : ""}`;
          ol.append(li);
        }
        const hits = r.headers.get("CMR-Hits");
        out.replaceChildren(
          Object.assign(document.createElement("p"), {
            textContent: !hits ? "The newest files:"
              : Number(hits) === 1 ? "This collection holds a single file:"
              : `${Number(hits).toLocaleString()} files in this collection. The ${Math.min(5, Number(hits))} newest:`,
          }),
          ol,
        );
      } catch (err) {
        out.textContent = `The search didn't complete: ${err.message}. Try again in a moment.`;
      } finally {
        btn.disabled = false;
      }
    });
  }
})();
