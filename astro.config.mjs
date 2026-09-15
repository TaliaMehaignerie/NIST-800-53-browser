import { defineConfig } from 'astro/config';

// Architecture spine AD-1: static output, no backend, no server adapter.
// Architecture spine AD-6: GitHub Actions runs `astro build` then Pagefind
// indexing (see package.json "build"), then an artifact-based Pages deploy.
export default defineConfig({
  output: 'static',

  // GitHub Pages *project* site: served from
  // https://taliamehaignerie.github.io/NIST-800-53-browser/
  // `base` must match the repo name EXACTLY (it is case-sensitive in the
  // served path) or every deep link (AD-4) 404s in production.
  site: 'https://taliamehaignerie.github.io',
  base: '/NIST-800-53-browser',
});
