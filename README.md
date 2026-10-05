# NIST 800-53 Browser & Compliance Workbench

A fast, readable way to browse [NIST SP 800-53 Rev 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final), plus a lightweight workbench for deciding what each control requires of a specific system.

**Live site: [taliamehaignerie.github.io/NIST-800-53-browser](https://taliamehaignerie.github.io/NIST-800-53-browser/)**

## Background

NIST SP 800-53 is the control catalog behind FISMA, FedRAMP and much of the U.S. federal risk-management world. Under the [Risk Management Framework](https://csrc.nist.gov/projects/risk-management) (NIST SP 800-37), a system is categorized by the impact a breach would have (FIPS 199). That categorization selects a baseline of controls (Low, Moderate, High, plus a Privacy baseline), which is then tailored, implemented, assessed and monitored.

Many controls contain organization-defined parameters (ODPs): blanks an organization fills in, such as how often accounts are reviewed, how long audit records are kept, or who must be notified. The Moderate baseline has 643 of them. Left unexamined, a control can be marked "implemented" while nobody has decided what implementing it means. This project is built around that gap.

## What it does

### Catalog

- Every control and enhancement from NIST's own [OSCAL](https://pages.nist.gov/OSCAL/) catalog (Rev 5.2.0): 20 families, 1,014 current items, 182 withdrawn, shown verbatim. The page footer records the catalog version.
- Baseline badges and filtering, full-text search including NIST's discussion text, and enhancements that expand inline.
- An ISO/IEC 27001:2022 crosswalk on each control, transcribed from NIST's official mapping, including NIST's own flag for partial matches.
- Keyboard-accessible, works on phones, every view is a shareable URL.

### Compliance workbench

| RMF step | What the workbench provides |
| --- | --- |
| Categorize / Select | Asks once which baseline the system is working toward, then scopes everything to it. Changing baselines previews what the move adds. |
| Tailor / Implement | A guided review queue and a review card on every control: set each parameter (confirm NIST's wording or record the organization's value, with a rationale for any override), then record implementation status, an owner, and evidence. |
| Assess | Evidence is recorded as structured references (note, link, collected-on date). |
| Authorize | Exports decisions as an OSCAL Profile. |
| Monitor | A progress dashboard by family, plus a "what's blocking me" list of controls held back by unreviewed parameters. |

## Design decisions

- A control can't be marked compliant while its own parameters are undecided. This is a hard block, not a warning, and the message names how many parameters are outstanding and in which baseline (a control can be ready under Moderate and not under High).
- Completion percentages always show their raw fraction (e.g. `64% (176/275)`) and round down, so 199 of 200 reads 99%, never 100%. "Not applicable" items are excluded from the denominator rather than counted as done. Withdrawn controls never count. Program-wide PM controls, which no baseline lists, are included under every baseline and labelled as such.
- A parameter already decided in another baseline is proposed, never copied, since Low ⊂ Moderate ⊂ High means moving baselines involves meeting hundreds of already-decided parameters. The source baseline is named, and nothing counts as reviewed until confirmed — a silent copy could claim a Moderate posture in a system that needs High's stricter values.
- "Inherited from a provider" is a structured justification for not-applicable, reflecting the shared-responsibility model of cloud authorizations. Bulk not-applicable for a fully inherited family still records each control as an individually reviewable decision.
- Evidence is referenced, not stored. A static site is the wrong system of record for evidence files (no access control, retention policy or backup), so the workbench records where the evidence lives and when it was collected.
- Parameters are not pre-filled with suggested values. I looked at FedRAMP's published baselines as a source: the current 2026 rules assign values to only 19 parameters, and the older spreadsheet that covers more is marked by FedRAMP as superseded ("use with extreme caution"). Each parameter instead links to NIST's own discussion of the control, verbatim.

## Data handling

There is no backend. All decisions, statuses and evidence references live in the browser's local storage, and nothing is transmitted.

- Backup and restore: one versioned file holds everything. Restore validates the whole file before writing anything, confirms what it will overwrite, and rolls back on failure.
- A storage-budget indicator warns before browser storage fills up.
- User-entered text is never rendered as HTML, and evidence links are restricted to `http(s)`.

## How it's built

- Static site: [Astro](https://astro.build/), with [Pagefind](https://pagefind.app/) search and no client-side framework. Deployed to GitHub Pages by GitHub Actions on every push to `main`.
- NIST's OSCAL JSON (catalog plus resolved baseline profiles) is ingested at build time into typed content collections, so every page and the exported OSCAL come from one source.
- Design invariants are recorded as architecture decisions (e.g. one module owns decision writes, one counting rule set for every percentage). Each feature was specified with acceptance criteria before being built.
- Each story was checked in a headless browser against independent calculations from the source data, then reviewed. Checks covered counts matching recomputed figures, refusal and rollback paths on failed writes, cross-tab behavior, keyboard access, and hostile input.

## Scope and limitations

- Not an official source. This is an unofficial tool, not a substitute for the published NIST SP 800-53 Rev 5 in any audit context.
- Single user, single browser. Not a multi-user GRC platform — no accounts, sharing, or approval workflow.
- No generated narratives. It records structured status and evidence references, not System Security Plan prose.
