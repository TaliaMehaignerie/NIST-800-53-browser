# Glossary — NIST 800-53 Browser

Domain terms used verbatim across `SPEC.md` and the adopted architecture spine. No synonyms.

- **OSCAL** — Open Security Controls Assessment Language, NIST's machine-readable format for security control catalogs. This product's data source of record.
- **Catalog** — The full set of Control Families and Controls published as the OSCAL representation of NIST SP 800-53 Rev 5.
- **Control Family** — A named grouping of related Controls, identified by a two-letter prefix (e.g., AC = Access Control). A Catalog contains many Control Families; a Control belongs to exactly one.
- **Control** — A single named requirement (e.g., AC-2 Account Management). Belongs to one Control Family; may have zero or more Control Enhancements.
- **Control Enhancement** — A refinement of a base Control, identified by the base Control ID plus a parenthetical number (e.g., AC-2(1)). Inherits its parent Control's Family, but not its Baseline membership — enhancement-level Baseline membership is independent (see the adopted spine's AD-2).
- **Baseline** — A named subset of Controls/Enhancements NIST designates as a minimum for a given impact level: Low, Moderate, High, or Privacy.
- **ISO Crosswalk** — NIST's official published mapping between 800-53 Controls and corresponding ISO/IEC 27001:2022 clauses. Published by NIST as a `.docx` document (not native OSCAL); this product hand-transcribes it into a checked-in structured file (see the adopted spine's AD-2).
- **Control Detail Page** — The page for a single Control: its statement, its Enhancements (expandable inline), its Baseline membership, and its ISO Crosswalk entries.
- **Deep Link** — A URL that loads directly to a specific piece of state (a Control, an expanded Enhancement, a Baseline-filtered list, a search result) without prior navigation.
