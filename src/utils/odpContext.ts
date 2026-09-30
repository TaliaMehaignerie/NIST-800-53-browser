/**
 * Context for answering a parameter: NIST's own Discussion text for the
 * control or enhancement it belongs to, shown on demand beside the value field.
 *
 * NIST publishes no default values for organization-defined parameters, and a
 * parameter's own guideline only restates the blank ("a time period … is
 * defined"). The Discussion is the one authoritative explanation of what the
 * control is for, so it is what we show — verbatim (AD-5), never paraphrased
 * or turned into suggested values.
 *
 * An inline disclosure rather than a hover tooltip: the text runs to ~4 KB,
 * which a hover box cannot hold readably and keyboard or touch users cannot
 * reach. The text arrives through `load`, so a surface can take it from the
 * page it is on (control pages) or fetch it once, lazily (the workspace).
 */
import { odpDiscussionUrl } from './url';

export function buildDiscussionToggle(controlLabel: string, uid: string, load: () => Promise<string | null>): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'odp-discussion';

  const panelId = `${uid}-discussion`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'odp-discussion__toggle';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', panelId);
  const showText = `What is this for? Show NIST's discussion of ${controlLabel}`;
  button.textContent = showText;

  const panel = document.createElement('div');
  panel.className = 'odp-discussion__text';
  panel.id = panelId;
  panel.hidden = true;
  // Focusable, labelled region: where it scrolls (inside the popover) a keyboard user can still read all of it.
  panel.tabIndex = 0;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `NIST discussion of ${controlLabel}`);

  let loaded = false;
  button.addEventListener('click', async () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? `Hide NIST's discussion of ${controlLabel}` : showText;
    panel.hidden = !open;
    if (!open || loaded) return;

    panel.textContent = 'Loading…';
    try {
      const text = await load();
      panel.textContent = text?.trim() ? text : `NIST publishes no discussion for ${controlLabel}.`;
      loaded = true;
    } catch (err) {
      console.error('odpContext: could not load discussion text', err);
      panel.textContent = 'Could not load the discussion. Reload the page to try again.';
    }
  });

  wrap.append(button, panel);
  return wrap;
}

/** Control pages already render each item's Discussion; read it from there instead of shipping it twice. */
export function discussionFromPage(slug: string): Promise<string | null> {
  return Promise.resolve(document.querySelector(`[data-discussion-for="${CSS.escape(slug)}"]`)?.textContent ?? null);
}

let discussionsPromise: Promise<Record<string, string>> | null = null;

/** The workspace fetches every item's Discussion once, only when the first panel is opened. */
export function discussionFromEndpoint(slug: string): Promise<string | null> {
  discussionsPromise ??= fetch(odpDiscussionUrl()).then((response) => {
    if (!response.ok) throw new Error(`odp-discussion.json fetch failed: ${response.status}`);
    return response.json() as Promise<Record<string, string>>;
  });
  const pending = discussionsPromise;
  return pending
    .then((all) => (Object.prototype.hasOwnProperty.call(all, slug) ? all[slug] : null))
    .catch((err) => {
      if (discussionsPromise === pending) discussionsPromise = null; // allow a retry after a failure
      throw err;
    });
}
