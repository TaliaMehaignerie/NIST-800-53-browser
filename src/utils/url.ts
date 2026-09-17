/**
 * The one shared base-aware link builder (architecture spine AD-4).
 *
 * The site deploys to a GitHub Pages project subpath (`astro.config.mjs`'s
 * `base: '/NIST-800-53-browser'`). A hardcoded `/controls/ac-2` works in
 * `astro dev` (served at the domain root) but 404s once deployed. Every page
 * and component builds internal links through these functions instead of
 * hand-rolling a path, so there is exactly one place that knows the base.
 */

/**
 * `import.meta.env.BASE_URL` reflects `astro.config.mjs`'s `base` verbatim —
 * it is NOT guaranteed to end in `/` (this project's `base` is
 * `/NIST-800-53-browser`, no trailing slash). Strip any trailing slash here
 * so every builder below controls its own single `/` separator, rather than
 * risking a doubled or missing slash depending on how `base` happens to be
 * spelled.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function homeUrl(): string {
  return `${BASE}/`;
}

export function familyUrl(slug: string): string {
  return `${BASE}/families/${slug}/`;
}

export function controlUrl(slug: string): string {
  return `${BASE}/controls/${slug}/`;
}

export function searchUrl(): string {
  return `${BASE}/search/`;
}
