---
name: 'Version Verification Review'
type: review
target: architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md
reviewed: '2026-08-20'
verdict: PASS-WITH-NOTES
---

# Version Verification Review — NIST 800-53 Browser Architecture Spine

Scope: independently re-verify (via live web search, not training-data recall) every version/technology claim in the Stack table and the tooling it implies — Astro, Node.js, Pagefind, astro-pagefind, GitHub Pages/Actions.

## Verdict: PASS-WITH-NOTES

All headline version claims in the spine check out against current sources (checked 2026-08-20). One material nuance is missing from the spine — the specific `astro-pagefind` npm integration is in UI maintenance mode — and one minor precision gap (Node engines floor) is worth a one-line tightening. Neither invalidates the architecture; both are flagged below.

## Findings

### 1. Astro 7.2.4 — CONFIRMED, current
- Spine claims: "Astro | 7.2.4 (verified current, Aug 2026)".
- Verified directly against the npm registry (`registry.npmjs.org/astro/latest`): current published version is **7.2.4**.
- Astro 7 is the current major line (Astro 6 stable shipped Feb 2026, Astro 7 shipped June 2026), so pinning to the latest 7.x is a live, non-stale choice, not an assumption carried from training data.
- Sources: https://www.npmjs.com/package/astro , https://astro.build/blog/astro-6-beta/ , https://github.com/withastro/astro

### 2. Node.js requirement — CONFIRMED, but spine is looser than the actual floor
- Spine claims: "Node.js | 22 LTS or later (Astro 7 baseline)".
- Verified: Astro 7.2.4's own `package.json` engines field requires **`>=22.12.0`**, not just "Node 22." Astro 6.x/7.x dropped support for Node 18 and for Node 22 versions below 22.12.0 (this was an Astro 5.8-era change, carried forward).
- This is a minor precision gap, not an error — anyone running current Node 22 LTS will already be ≥22.12.0 — but the spine should say "Node.js ≥22.12.0" rather than the vaguer "22 LTS or later" so a reader on an older 22.x patch doesn't get a confusing build failure.
- Node LTS status check: Node 22 is in **Maintenance LTS** (security support scheduled to end 2027-04-30); Node 24 is the current **Active LTS**; Node 26 is the newest LTS line (promoted ~mid-2026). Node 22 remains a fully supported, valid choice for a project starting now, it's just past its Active LTS window — worth knowing if this project expects a multi-year lifespan, since Maintenance LTS is the last support phase before EOL.
- Sources: https://registry.npmjs.org/astro/latest , https://endoflife.date/nodejs , https://alternativeto.net/news/2025/5/astro-5-8-raises-node-js-requirements-as-support-for-node-js-v18-ends

### 3. Pagefind core — CONFIRMED, actively maintained
- Spine claims: "Pagefind ... latest at build time — Rust-based static search index."
- Verified: Pagefind's core project (github.com/Pagefind/pagefind) is actively released; latest tagged release is **v1.5.2** (2026-04-12), a performance/bugfix follow-up to the v1.5.0 UI overhaul (new web-component search UI, better ranking, Web Worker search, smaller/faster indexes). Commit and release activity continues into 2026.
- "Latest at build time" as a version policy is reasonable and correctly avoids pinning a stale version in the spine itself — but see Deferred/Note below on pinning discipline.
- Sources: https://github.com/Pagefind/pagefind/releases , https://pagefind.app/

### 4. `astro-pagefind` integration — CONFIRMED to exist and work, but flagged: UI layer is in maintenance mode
- Spine claims: "Pagefind (+ astro-pagefind integration)."
- Verified: the npm package `astro-pagefind` (github.com/shishkin/astro-pagefind) exists, is current (latest published version 1.8.5, ~4 months old as of this check), and does what the spine needs — runs Pagefind indexing as part of `astro build` and serves a prebuilt index in dev.
- **Not previously confirmed in the spine, and worth recording**: the package's own README states its bundled `Search.astro` UI component "is now in maintenance mode and will not receive any new UI-related features anymore," following Pagefind's 1.5.0 release, which shipped its own official web-component search UI. The README's own recommendation for new projects is to adopt Pagefind's native web-component UI directly rather than lean on `astro-pagefind`'s `Search.astro`.
- Architectural impact: **low**. The spine's AD-7/FR-5 design already puts the SearchBox island under this project's own control (`components/SearchBox`), not the `astro-pagefind` `Search.astro` component, so the maintenance-mode note doesn't block anything already decided. It does mean: when FR-5 is implemented, `astro-pagefind` should likely be used only for its indexing role (running Pagefind at build time), with the actual search-box UI hand-built or built against Pagefind's own web components rather than the astro-pagefind Search component — this is a downstream implementation note, not a spine-level blocker, but it should be carried forward so the implementer doesn't reach for the deprecated UI path by default.
- Sources: https://github.com/shishkin/astro-pagefind , https://www.npmjs.com/package/astro-pagefind

### 5. GitHub Pages + GitHub Actions — CONFIRMED, still a live, free, standard path
- Spine claims (AD-6): "GitHub Actions, triggered on push to `main`, is the only path that publishes to `gh-pages`."
- Verified: GitHub Pages remains free for public repositories in 2026 (private-repo Pages requires a paid plan, not relevant here since this is a public open dataset project), and GitHub's own documented, current recommended workflow for non-Jekyll static sites is exactly this pattern — a GitHub Actions workflow that builds the site and deploys via GitHub's official Pages actions, triggered on push. No sign of deprecation or a superseding mechanism.
- Sources: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site , https://www.startuphub.ai/ai-news/technology/2026/github-pages-free-websites-for-projects

## Not independently re-litigated
- The spine's choice of `gh-pages` as the publish branch name (vs. GitHub's newer native Pages deployment action that doesn't require a branch at all) is an implementation detail inside AD-6/`deploy.yml`, not a version-currency question — out of scope for this check, but worth a look when `deploy.yml` is actually written, since GitHub's current documented default no longer requires a dedicated `gh-pages` branch.

## Summary Table

| Claim | Status | Confirmed against |
| --- | --- | --- |
| Astro 7.2.4 is current | Confirmed | npm registry live fetch |
| Node.js 22 LTS+ required by Astro 7 | Confirmed, imprecise (`>=22.12.0` is the real floor) | npm registry `engines` field |
| Pagefind actively maintained | Confirmed | GitHub releases (v1.5.2, Apr 2026) |
| `astro-pagefind` integration current and working | Confirmed, with caveat | GitHub README (UI component in maintenance mode) |
| GitHub Pages + Actions still free/standard for static sites | Confirmed | GitHub docs |
