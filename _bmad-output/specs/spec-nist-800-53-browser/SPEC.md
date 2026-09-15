---
id: SPEC-nist-800-53-browser
companions: ['glossary.md', '../../planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md']
sources: ['../../planning-artifacts/prds/prd-BMad-2026-08-20/prd.md']
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. `sources:` is for traceability only — the PRD's narrative rationale, not restated here.

# SPEC: NIST 800-53 Browser

## Why

NIST SP 800-53 Rev 5 ships as a several-hundred-page PDF, and the government's own search over it is clunky — anyone who actually needs to *use* the catalog (confirm a control's requirement, check its baseline membership, find its ISO 27001 counterpart) ends up fighting the document instead of reading the requirement. This is both a pain to solve and a vision to realize, for a broad, mixed audience — security engineers, ISSOs, auditors, compliance managers, developers — who need a fast, phone-readable, deep-linkable reader over NIST's own OSCAL representation of the catalog, so a straight answer about a control takes less time to find than the same passage would in the PDF.

## Capabilities

- **CAP-1**
  - **intent:** A user can browse the full NIST SP 800-53 Rev 5 catalog by Control Family, drilling from family → control → detail.
  - **success:** Every published Rev 5 Control Family and Control is reachable via the family tree; none silently dropped.

- **CAP-2**
  - **intent:** A user can filter list views to a single Baseline (Low, Moderate, High, or Privacy).
  - **success:** Each Control/Enhancement in view shows its Baseline membership; the filtered view is itself deep-linkable.

- **CAP-3**
  - **intent:** A user can read a Control's full statement and expand/collapse any of its Enhancements in place, without navigating away.
  - **success:** Expanding an Enhancement does not navigate away from the parent Control's page; each Enhancement is individually deep-linkable to its expanded state.

- **CAP-4**
  - **intent:** A user viewing a Control Detail page sees the related ISO/IEC 27001:2022 clause(s), sourced from NIST's own crosswalk.
  - **success:** Crosswalk data matches the hand-transcribed source (see `glossary.md` — ISO Crosswalk); a Control with no published mapping states that explicitly rather than rendering blank.

- **CAP-5**
  - **intent:** A user can search by Control ID, title, or statement keyword and reach the matching Control directly.
  - **success:** Searching "AC-2" or "account management" both surface AC-2; the search entry point is available on every screen, with a full-page navigation to `/search` when submitted elsewhere and reload-free updates once already there (see the adopted architecture spine's AD-3).

- **CAP-6**
  - **intent:** A user can share a URL to any meaningful state (a Family, a Control, an expanded Enhancement, a Baseline filter, a search result) and have it load directly, with no prior navigation.
  - **success:** Every such state has a stable, human-readable URL that round-trips correctly on a cold load (link pasted fresh into a browser).

## Constraints

- **Static-site only.** All data resolves at build time; no server, database, or runtime API. Rules out any dynamic backend feature.
- **No accounts.** Public, free, no login.
- **Content fidelity.** Control statements and titles render verbatim from the ingested OSCAL data — no paraphrasing anywhere in the pipeline.
- **Data provenance.** Every page states the source OSCAL Catalog version and crosswalk transcription date it renders.
- **Not an authoritative source.** An "unofficial reading tool, not for audit/compliance use" disclaimer renders on every page.
- **Single canonical ingestion pipeline.** One local, human-run script is the only code path allowed to read raw OSCAL/crosswalk source; its committed output is the only thing pages, components, and CI may read.
- **URL-owned shareable state.** Baseline filter, expanded-enhancement, and search-query state live only in the URL, merged non-destructively — never local-only component state.
- **Mobile-first is required; formal accessibility compliance is not.** Phone-readable layout is a hard requirement; no WCAG 2.1 AA (or similar) target for v1.
- **Do not optimize for engagement.** A fast, correct answer followed by leaving is the success case — session length / time-on-page is not a metric to chase.
- **Free/low-cost hosting only.** GitHub Pages via GitHub Actions (artifact-based deploy).
- **Everything else structural is governed by the adopted architecture spine** (see `companions:`) — stack versions, routing/slug scheme, and every other build-time invariant live there, not restated here.

## Non-goals

- Not a GRC/compliance-management platform — no control tailoring, POA&M tracking, or 800-53A assessment workflows.
- Not an official NIST publication or an audit-ready compliance record.
- Not multi-framework in v1 — only 800-53 plus NIST's own ISO 27001 crosswalk; no CMMC, PCI-DSS, or other mappings (revisit only if requested repeatedly).
- Not collaborative — no accounts, comments, annotations, saved views, or export/reporting.
- Not a native app — responsive web only.
- No withdrawn-control tracking or Rev 4 comparison view.
- No automated/scheduled re-ingestion in v1 — the maintainer re-runs the ingestion script by hand.
- No scripted docx-parsing or OSCAL-native Mapping-model authoring for the ISO crosswalk in v1 — hand-transcription only.
- No staging/multi-environment setup.

## Success signal

The builder (and anyone else who finds it) reaches for this instead of the PDF or NIST's own search whenever they need to look up a control, and still does a month after launch. People who find it organically come back more than once.

## Assumptions

- "NIST 800-53 Browser" is a placeholder working title, not a confirmed product name.
- Performance targets (~2s initial load, ~200ms navigation) are rough hobby-scope bounds, not measured or benchmarked.
- The ingestion script's implementation language (Node.js) is a convention-following default, not a binding requirement — it's a local, one-off tool outside the deployed system.

## Open Questions

- What cadence should the maintainer use to manually re-run ingestion when NIST publishes catalog/crosswalk updates — a periodic check, or only on announced amendments?
- Exact disclaimer wording is undecided. Placement (global footer, every page) is fixed by the architecture spine; the copy itself is not.
- Does Pagefind's default matching (which may include some fuzzy/typo tolerance) need tightening to match the "plain substring is enough" v1 intent, and does it tokenize hyphenated control IDs (`AC-2`) correctly? Needs verification once search is built.
