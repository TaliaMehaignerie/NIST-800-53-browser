import { defineConfig } from 'astro/config';

// Architecture spine AD-1: static output, no backend, no server adapter.
// Architecture spine AD-6: GitHub Actions runs `astro build` then Pagefind
// indexing (see package.json "build"), then an artifact-based Pages deploy.
export default defineConfig({
  output: 'static',

  // TODO before first deploy: a GitHub Pages *project* site serves from
  // https://<user>.github.io/<repo>/, so BOTH of these must be set or every
  // deep link (AD-4) will 404 in production.
  // site: 'https://<user>.github.io',
  // base: '/nist-800-53-browser',
});
