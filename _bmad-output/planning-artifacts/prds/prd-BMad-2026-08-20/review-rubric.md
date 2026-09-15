# PRD Quality Review — NIST 800-53 Browser

## Overall verdict

This is a well-calibrated hobby-scope PRD: it has a real thesis, honest trade-offs, and scope boundaries that are stated rather than implied, and it shows unusual transparency by recording which assumptions were resolved by the user versus left open. The one place it falls short of "ready to build" is Done-ness — the flagship testable example for search (FR-5) is internally contradictory, and the PRD's central differentiator (speed vs. the PDF) has no measurable bound anywhere in the document. Fix those two things and this PRD does its job cleanly at the scope it set for itself.

## Decision-readiness — strong

Decisions are stated as decisions, not hedged into "considerations." The NFR section explicitly trades away a real thing and says so: "No formal accessibility standard (e.g., WCAG 2.1 AA) is targeted for v1, but phone readability itself is not optional" (Cross-Cutting NFRs) — that's a trade-off named with what was given up, not smoothed to "the tool will be accessible." The `[NOTE FOR PM]` tags land on genuine tensions (revisit multi-framework support "if requested more than once," §6.2 and Open Question 4) rather than safe checkpoints. The closing line of §9 — "Resolved during review: search in v1 scope, no-backend/static-site approach, and no formal accessibility target... confirmed by user 2026-08-20" — is a good practice not required by the rubric: it shows which calls were made and by whom, rather than leaving the reader to guess what's settled.

Open Questions are genuinely open: OQ1 (update cadence for catalog/errata) and OQ2 (disclaimer placement) have no answer buried in the next sentence.

No findings.

## Substance over theater — strong

Two UJs (Priya, Jordan), each tied to specific FRs and each doing distinct work — Priya exercises baseline filtering and deep-linking, Jordan exercises inline enhancement expansion and search. Neither is decorative. The Vision statement is specific to this product's failure mode ("fighting the document instead of reading the requirement") rather than a swappable category-generic paragraph. No differentiation-for-its-own-sake section, no boilerplate NFR language like "must be scalable/secure" without a threshold — except the performance NFR, which is thin enough to flag under Done-ness rather than here (it's underspecified, not copy-pasted boilerplate).

No findings.

## Strategic coherence — strong

The thesis is explicit: get a correct answer faster than you could find the same passage in the PDF (§1, restated in the FR-5 description). Every FR traces back to it — browse/filter/inline-expand/crosswalk/search are all "stop fighting the document" mechanisms, not a grab-bag of capabilities. Success Metrics validate the thesis rather than measuring activity: SM-1 is a retention/self-replacement signal ("I reach for this instead of the PDF... and still am a month after launch"), and SM-C1 explicitly excludes session length as a target — "A fast, correct answer followed by leaving is success, not a failure to 'engage.'" That's a counter-metric that actually counters something, not a token gesture.

No findings.

## Done-ness clarity — adequate

Structurally this dimension is well set up — every FR has a "Consequences (testable)" block, and most of them are genuinely testable (e.g., FR-3: "Expanding an Enhancement does not navigate away from the parent Control's page or lose scroll position"; FR-4: "When no mapping exists for a control, the page states that explicitly... rather than showing nothing"). Two problems keep it from "strong":

### Findings
- **high** Search acceptance example is self-contradictory (§4.5, FR-5 Consequences, line 119) — "Searching 'AU-2' or 'account management' both surface AC-2 (ID and title matches at minimum)" conflates two different controls. AC-2 is "Account Management" (per the Glossary example at §3), so "account management" correctly surfacing AC-2 makes sense — but AU-2 is a distinct control (used correctly elsewhere, in UJ-2: "whether the team's logging meets AU-2... he searches 'AU-2'"). As written, this is the one concrete, testable example given for the search FR, and it's wrong or at minimum deeply confusing for whoever writes the acceptance test. *Fix:* change "AU-2" to "AC-2" in the FR-5 consequence bullet (or supply two separate correct examples, one per control).
- **medium** Performance NFR has no bound (Cross-Cutting NFRs, line 181) — "Pages load fast and navigating between controls feels close to instant" is exactly the kind of adjective-only performance language the rubric calls out, and it's not a peripheral NFR here — speed vs. the PDF is the PRD's stated reason to exist ("the entire point is beating a several-hundred-page PDF for speed of finding an answer," §1 and NFR restate it). Nothing in the document gives an engineer a number to hit or a way to know if they've succeeded. *Fix:* even a loose hobby-scope bound works — e.g., "control detail page interactive in under 1s on a mid-range phone over 4G" — rather than leaving "fast" undefined.

## Scope honesty — strong

§5 Non-Goals is substantive (five bullets, each naming a real category of exclusion with a reason, not a token line). §6.2 Out of Scope for MVP is explicit and carries a `[NOTE FOR PM]` at the one boundary likely to be revisited (other frameworks). Two `[ASSUMPTION]` tags (working title, §Title; unofficial/no-disclaimer-drafted, §2.2) both round-trip into the §9 Assumptions Index — no orphans either direction. Open-items density (2 assumptions + 4 open questions + 2 NOTE FOR PM ≈ 8) is proportionate to a hobby-scope PRD, not a green-light-to-build document masking unresolved tensions.

No findings.

## Downstream usability — strong

Glossary (§3) is used consistently for the FR-critical terms (Baseline, Control Family, Control Enhancement, Deep Link). FR/UJ/SM IDs are contiguous and unique (FR-1…FR-5, UJ-1…UJ-2, SM-1/SM-2/SM-C1) and inline cross-references ("see Cross-Cutting NFRs," "see Assumptions Index") resolve to sections that exist in the document. Both UJs carry a named protagonist with role and device context inline (Priya/ISSO/desktop-link-sharing; Jordan/phone/mid-standup) — no floating UJs.

### Findings
- **low** Glossary term used inconsistently — §3 defines the canonical term "Control Detail Page," but §4.1 ("opens its Detail page") and §4.5 ("reach a matching Control's Detail page") both drop to the shorthand "Detail page." Minor, but exactly the kind of drift that compounds if UX or architecture treats "Detail page" and "Control Detail Page" as distinct concepts. *Fix:* normalize to the glossary term, or add "Detail page" as a noted shorthand in §3.

## Shape fit — strong

The PRD self-calibrates rather than defaulting to a template: it explicitly names the dial it turned — "(Lighter scope dial used per hobby/solo project — single-sentence journeys, no numbered flow.)" (§2.3) — and follows through with exactly two UJs, single-sentence, no flow diagrams. That's the right call for a consumer-facing (if low-stakes) reading tool: UJs are load-bearing enough to justify keeping two, but the PRD doesn't over-formalize with more personas or numbered flows a solo hobby project doesn't need. No stakeholder sign-off, ROI, or formal compliance-program sections — correctly absent given the stated stakes.

No findings.

## Mechanical notes

- **Section numbering break:** Cross-Cutting NFRs and Constraints and Guardrails appear after a horizontal rule (line 177) without section numbers, breaking the §1–§9 numbering scheme the rest of the document uses. Inline cross-references to them still resolve by name ("see Cross-Cutting NFRs"), so this doesn't break anything today, but it's inconsistent with the document's own numbering convention and could trip up tooling that expects contiguous numbered sections. Consider numbering them §10/§11 or explicitly marking them as an appendix.
- **Assumptions Index roundtrip:** Clean. Both inline `[ASSUMPTION]` tags (§Title, §2.2) are indexed in §9; no index entries lack an inline counterpart.
- **ID continuity:** Clean. FR-1…FR-5, UJ-1…UJ-2, SM-1/SM-2/SM-C1 — no gaps, no duplicates.
- **UJ protagonist naming:** Both UJs (Priya, Jordan) are named and carry role/context inline — no floating UJs.
- **Glossary drift:** See Downstream usability finding above ("Detail page" vs. "Control Detail Page").
- **Required sections for stated stakes:** All present and appropriately scoped — Vision, Target User (JTBD + Non-Users + UJs), Glossary, Features/FRs, Non-Goals, MVP Scope, Success Metrics, Open Questions, Assumptions Index, Cross-Cutting NFRs, Constraints. Nothing enterprise-scale is missing because nothing enterprise-scale was in scope.
