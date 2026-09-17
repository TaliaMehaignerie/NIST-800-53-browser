# NIST 800-53 Browser

A fast, phone-readable way to read [NIST SP 800-53 Rev 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) with a search tool and baseline filter.

**🔗 [Link to browser webpage](https://taliamehaignerie.github.io/NIST-800-53-browser/)**

## What it does

- **Browse by family** — all 20 Control Families (Access Control, Audit and Accountability, etc.), each with its Controls in catalog order.
- **Filter by baseline** — narrow any Family or Control page to Low, Moderate, High, or Privacy.
- **Read enhancements inline** — expand/collapse a Control's Enhancements without navigating away, deep-linkable to one specific Enhancement.
- **See the ISO 27001 crosswalk** — each Control shows its mapped ISO/IEC 27001:2022 clauses, hand-transcribed from NIST's own official mapping.
- **Search** — by Control ID, title, or keyword (including NIST's own "Discussion" explanatory text), filterable by baseline.
- **Deep-linkable everything** — every view (a filtered list, an expanded enhancement, a search result) is a real URL you can share.

## Not an official source

This is an unofficial reading tool, not a substitute for the published NIST SP 800-53 Rev 5 document in any audit or compliance context. Content is ingested verbatim from NIST's own [OSCAL](https://github.com/usnistgov/oscal-content) catalog — see the site's own footer for the exact catalog version and crosswalk transcription date.

## Built with

Static site — [Astro](https://astro.build/), [Pagefind](https://pagefind.app/) for search, deployed to GitHub Pages via GitHub Actions on every push to `main`. No backend, no database, no client-side framework.
