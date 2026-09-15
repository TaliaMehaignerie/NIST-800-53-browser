/**
 * The one shared id -> slug function (architecture spine AD-4).
 *
 * Every caller — pages, islands, and `scripts/ingest.mjs` (AD-2) — imports
 * this module rather than reimplementing the transform, so two routes can
 * never generate different casings, separators, or normalization for the
 * same control.
 *
 * Input is ALWAYS the OSCAL-native id (`ac-2`, `ac-2.1`), never the canonical
 * display string (`AC-2`, `AC-2(1)`): parens and dots are not guaranteed to
 * normalize identically, so accepting display text would open a second,
 * silent slug variant. Passing a display label throws.
 */

/** OSCAL-native control / enhancement id: `ac-2`, `ac-2.1`, `si-10.1`. */
const OSCAL_CONTROL_ID = /^[a-z]{2}-\d+(\.\d+)?$/;

/**
 * Is this an OSCAL-native control / enhancement id?
 *
 * Exported so callers that resolve cross-references (e.g. a withdrawn
 * control's successor link, which may point at a whole family rather than a
 * control) can test a target before slugifying it, without rebuilding the
 * pattern locally and letting a second variant drift into existence.
 */
export function isOscalControlId(value: unknown): value is string {
  return typeof value === 'string' && OSCAL_CONTROL_ID.test(value);
}

/**
 * Convert an OSCAL-native control or enhancement id into its URL/filename slug.
 *
 * `ac-2` -> `ac-2`, `ac-2.1` -> `ac-2-1`.
 *
 * @throws {TypeError} if `oscalId` is not a lowercase OSCAL-native control id.
 */
export function slugify(oscalId: string): string {
  if (typeof oscalId !== 'string' || !OSCAL_CONTROL_ID.test(oscalId)) {
    throw new TypeError(
      `slugify() expects an OSCAL-native control id matching ${OSCAL_CONTROL_ID} ` +
        `(e.g. "ac-2", "ac-2.1") — received ${JSON.stringify(oscalId)}. ` +
        'Display labels such as "AC-2(1)" are not valid input (AD-4).',
    );
  }

  return oscalId.replaceAll('.', '-');
}
