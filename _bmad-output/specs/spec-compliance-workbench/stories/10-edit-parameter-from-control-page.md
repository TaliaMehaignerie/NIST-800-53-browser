---
title: 'Compliance Workbench — edit one parameter from the control page'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'acc51dbd5988a067f3cfeae4b84a38aae41947f1'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A reader can see a decided value on a control page (story 9) but must leave for the workspace to change it, losing the statement context that made the parameter answerable.

**Approach:** Clicking an in-baseline ODP slot opens an anchored popover that mounts `odpEdit.ts` for that one parameter: value, rationale, Confirm/Override, the parameter's guidelines, and a deep link to the workspace.

## Boundaries & Constraints

**Always:**
- All validation and saving go through `odpEdit.ts` (AD-9); the popover never calls `setDecision` and its refusal messages are the workspace's own.
- Popover data is embedded per page at build time from the same Content Collection (AD-8): only each control's param label/select/guidelines and family code. `odp-dataset.json` is never fetched; `statementProse` is not duplicated.
- Only slots in the working baseline are interactive. User-entered text is written with `textContent`; embedded JSON escapes `<`.
- Keyboard: Enter/Space opens, focus moves in and is trapped, Escape closes, focus returns to the slot.
- Deep link is `/workspace/{baseline}/?view=individual&family={CODE}`, already supported by the workspace.

**Never:** a second editing path, workspace changes, batch scope (story 11).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Confirm | Non-empty value | Saved, slot and header chip update | N/A |
| Override, no rationale | Value set | "A rationale is required to override a value." | Nothing written |
| Empty value | Blank | "Enter or select a value before saving a decision." | Nothing written |
| Storage failure | setDecision fails | Save-failed message, popover stays open | N/A |
| Out-of-baseline slot | Baseline excludes control | Not interactive | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/odpSlotPopover.ts` -- new: popover DOM, focus trap, Escape, deep link; mounts `odpEdit`.
- `src/components/OdpSlotOverlay.astro` -- embeds payload, makes in-baseline slots buttons, opens the popover, popover styles.
- `src/pages/controls/[slug].astro` -- builds the per-page payload for the control and its enhancements.

## Tasks & Acceptance

**Execution:**
- [x] Per-page payload and overlay wiring.
- [x] Popover module using `odpEdit`.

**Acceptance Criteria:**
- Given an in-baseline slot, when opened by click or Enter, then the popover shows value, rationale, guidelines and the workspace link, and focus is inside it.
- Given an override without rationale, then the workspace's message is shown and nothing is stored.
- Given Escape, then the popover closes and focus returns to the slot.

## Verification

- `npm run build` succeeds. Payload per page: median 569 bytes, max 12.9 KB (AC-4).
- Headless Edge: keyboard open/Escape/focus return, focus trap, both refusal messages, save updates slot, storage and chip (1/643), link and prefill correct, no page errors.

## Suggested Review Order

- Popover: sole mount of `odpEdit`, focus trap, deep link.
  [`odpSlotPopover.ts:48`](../../../../src/utils/odpSlotPopover.ts#L48)

- Overlay wiring: interactivity gated by baseline, open handlers.
  [`OdpSlotOverlay.astro:153`](../../../../src/components/OdpSlotOverlay.astro#L153)

- Payload built from the Content Collection per page.
  [`[slug].astro:48`](../../../../src/pages/controls/[slug].astro#L48)
