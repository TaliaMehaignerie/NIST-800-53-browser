/**
 * The one shared URL-state writer (architecture spine AD-3).
 *
 * Baseline filter state lives in `?baseline=`; expanded-enhancement state
 * (CAP-3, not built yet) will live in the URL fragment. Every island writes
 * through this one helper so that setting one piece (e.g. `search`) never
 * clobbers the piece it doesn't own (e.g. an existing `#ac-2-1` hash), and
 * every write uses `replaceState`, never `pushState` (EXPERIENCE.md ->
 * Interaction Primitives: filter/expand/search-in-place never add a history
 * entry).
 *
 * Built generic enough (search and hash handled independently) that CAP-3's
 * later Enhancement toggle can reuse it unmodified.
 */
export function setUrlState({
  search,
  hash,
}: {
  search?: Record<string, string | null>;
  hash?: string | null;
}) {
  const url = new URL(window.location.href);
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
  }
  if (hash !== undefined) {
    url.hash = hash ? `#${hash}` : '';
  }
  window.history.replaceState(null, '', url);
}
