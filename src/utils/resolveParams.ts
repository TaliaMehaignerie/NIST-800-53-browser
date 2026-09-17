/**
 * Resolves `{{ insert: param, <id> }}` placeholders (AD-5: ingested verbatim,
 * never rewritten at the ingestion layer) into NIST's own published
 * convention for organization-defined parameters -- e.g.
 * "[Assignment: organization-defined personnel or roles]" or
 * "[Selection (one-or-more): organization-level; mission/business
 * process-level; system-level]" -- rather than leaving the raw OSCAL
 * placeholder syntax on screen, which reads as broken text to a reader who
 * has no reason to know what OSCAL is.
 *
 * A placeholder whose id has no matching entry in `params` renders as-is,
 * verbatim (AD-5's original fallback) -- this should be rare in practice,
 * since every param a Control/Enhancement's own prose references is ingested
 * onto that same entry.
 */

interface Param {
  id: string;
  label: string | null;
  select: { howMany: string | null; choice: string[] } | null;
  guidelines: string[];
}

const PLACEHOLDER = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;

function describe(param: Param): string {
  if (param.select) {
    const howMany = param.select.howMany ? ` (${param.select.howMany})` : '';
    return `[Selection${howMany}: ${param.select.choice.join('; ')}]`;
  }
  if (param.label) {
    // Some ingested labels already include "organization-defined" (71 real
    // cases, e.g. "organization-defined personnel or roles"); others don't
    // (e.g. "official") -- never double it up.
    const phrase = /^organization-defined\b/i.test(param.label) ? param.label : `organization-defined ${param.label}`;
    return `[Assignment: ${phrase}]`;
  }
  return `[Assignment: organization-defined value]`;
}

export function resolveParams(prose: string, params: Param[]): string {
  const byId = new Map(params.map((p) => [p.id, p]));
  return prose.replace(PLACEHOLDER, (match, id) => {
    const param = byId.get(id);
    return param ? describe(param) : match;
  });
}
