/**
 * Whole-origin localStorage usage, for the storage budget only (story 18).
 *
 * This is the one deliberate exception to "all localStorage access goes
 * through the stores" (AD-10, AD-14), and it is READ-ONLY measurement: the
 * quota is shared by everything on the origin, and this site is served from a
 * `github.io` origin where other projects' keys count against it too, so the
 * budget cannot be computed from this app's own blobs alone. Nothing here
 * reads a value's meaning or writes anything.
 */
export function originUsageChars(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === null) continue;
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    // Unavailable storage measures as zero; the stores report their own failures.
  }
  return total;
}
