# NIST 800-53 Browser

A fast, phone-readable way to read [NIST SP 800-53 Rev 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) with a search tool and baseline filter. It also works as a small compliance workbench: decide NIST's organization-defined parameters, track implementation status and evidence, and see how complete you are — all stored in your own browser.

**🔗 [Link to browser webpage](https://taliamehaignerie.github.io/NIST-800-53-browser/)**

## What it does

- **Browse by family** — all 20 Control Families (Access Control, Audit and Accountability, etc.), each with its Controls in catalog order.
- **Filter by baseline** — narrow any Family or Control page to Low, Moderate, High, or Privacy.
- **Read enhancements inline** — expand/collapse a Control's Enhancements without navigating away, deep-linkable to one specific Enhancement.
- **See the ISO 27001 crosswalk** — each Control shows its mapped ISO/IEC 27001:2022 clauses, hand-transcribed from NIST's own official mapping.
- **Search** — by Control ID, title, or keyword (including NIST's own "Discussion" explanatory text), filterable by baseline.
- **Deep-linkable everything** — every view (a filtered list, an expanded enhancement, a search result) is a real URL you can share.

## Compliance workbench

Everything below is optional, runs entirely in the browser, and keeps its data in this browser's local storage — there is no backend and nothing is uploaded.

- **Review, control by control** — tell it once which baseline your system is working toward, then the Review page walks you through what's left. Each control has a review card: set its organization-defined parameters (643 in Moderate, 767 in High) — confirming NIST's wording or entering your own value, with NIST's discussion one click away — then record its status. A parameter table with batch entry is there for setting many at once.
- **Proposals, never copies** — a parameter you already decided in another baseline is proposed with its source named; nothing is saved until you confirm it, so moving from Moderate to High still costs an act of review.
- **Track status and evidence** — mark each Control and Enhancement incomplete, in progress, compliant or not applicable, with an owner and evidence references. "Inherited from a provider" is a first-class reason, and a Control cannot be marked compliant while its own parameters are unreviewed.
- **See where you stand** — a dashboard shows the completion percentage with its raw fraction beside it, broken down by family, plus what's blocking you. Changing your baseline shows what the move would add before you commit. The home page promotes it once you have data.
- **Export and back up** — export an OSCAL Profile, and download or restore everything in one versioned backup file. Restoring asks for confirmation and never applies a file partially.

## Not an official source

This is an unofficial reading tool, not a substitute for the published NIST SP 800-53 Rev 5 document in any audit or compliance context. Content is ingested verbatim from NIST's own [OSCAL](https://github.com/usnistgov/oscal-content) catalog — see the site's own footer for the exact catalog version and crosswalk transcription date.

## Built with

Static site — [Astro](https://astro.build/), [Pagefind](https://pagefind.app/) for search, deployed to GitHub Pages via GitHub Actions on every push to `main`. No backend, no database, no client-side framework.
