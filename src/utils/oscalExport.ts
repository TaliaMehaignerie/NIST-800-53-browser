/**
 * AD-12's sole OSCAL export implementation. Serializes the AD-10 decision
 * blob (via `odpStore.getDecisions`, unmodified) into an OSCAL Profile
 * document and triggers a client-side file download. No server round-trip,
 * no new storage (spec Intent).
 *
 * Schema validity is checked manually via `oscal-cli validate` during
 * development (FR-15) — no validator ships in this module or the client
 * bundle (spec Never).
 */

import type { Decision } from './odpStore';

/** The four NIST baselines this feature's route/dataset are parameterized for (spec Constraints: V1 = Moderate only, tested). */
export type Baseline = 'low' | 'moderate' | 'high' | 'privacy';

/**
 * The real ingested source filename for each baseline (spec Code Map,
 * verified: LOW/MODERATE/HIGH/PRIVACY variants all exist under
 * `data/raw/`). Truthful provenance for `profile.imports[].href` — never a
 * fabricated or unverified live URL (spec Boundaries).
 */
const BASELINE_SOURCE_FILENAME: Record<Baseline, string> = {
  low: 'NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json',
  moderate: 'NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json',
  high: 'NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json',
  privacy: 'NIST_SP-800-53_rev5_PRIVACY-baseline-resolved-profile_catalog-min.json',
};

interface OscalSetParameter {
  'param-id': string;
  values: string[];
  remarks?: string;
}

export interface OscalProfile {
  profile: {
    uuid: string;
    metadata: {
      title: string;
      'last-modified': string;
      version: string;
      'oscal-version': string;
    };
    imports: { href: string }[];
    modify: {
      'set-parameters': OscalSetParameter[];
    };
  };
}

interface BuildOscalProfileArgs {
  baseline: Baseline;
  decisions: Record<string, Decision>;
  oscalVersion: string;
}

/**
 * Recovers the original OSCAL param id from an AD-10 decision key
 * (`${controlSlug}:${paramId}`) by taking everything after the first `:` —
 * never the cluster-stripped key (spec Boundaries). `paramId` itself may
 * legitimately contain `:` characters it never does in this corpus, but
 * splitting on the *first* colon only is the documented, safe rule.
 */
function paramIdFromKey(key: string): string {
  const idx = key.indexOf(':');
  return idx === -1 ? key : key.slice(idx + 1);
}

function buildSetParameter(key: string, decision: Decision): OscalSetParameter {
  const setParameter: OscalSetParameter = {
    'param-id': paramIdFromKey(key),
    values: Array.isArray(decision.value) ? decision.value : [decision.value],
  };

  if (decision.rationale.trim().length > 0) {
    setParameter.remarks = decision.rationale;
  }

  return setParameter;
}

/**
 * Builds an OSCAL Profile document object from the current decisions for a
 * baseline. One `set-parameter` per stored decision — `Object.entries` is
 * iterated directly, one entry per call (spec Boundaries: AD-11 already
 * guarantees every dash-one cluster member is its own independent decision
 * in the blob, so no cluster-awareness is needed here).
 */
export function buildOscalProfile({ baseline, decisions, oscalVersion }: BuildOscalProfileArgs): OscalProfile {
  const baselineLabel = `${baseline[0].toUpperCase()}${baseline.slice(1)}`;
  const now = new Date().toISOString();

  const setParameters = Object.entries(decisions).map(([key, decision]) => buildSetParameter(key, decision));

  return {
    profile: {
      uuid: crypto.randomUUID(),
      metadata: {
        title: `${baselineLabel} Baseline ODP Decisions`,
        'last-modified': now,
        version: '1.0.0',
        'oscal-version': oscalVersion,
      },
      imports: [{ href: BASELINE_SOURCE_FILENAME[baseline] }],
      modify: {
        'set-parameters': setParameters,
      },
    },
  };
}

/**
 * Serializes a Profile document to formatted JSON and triggers a
 * client-side file download — `Blob` + object URL + a temporary
 * `<a download>` click, no server (spec Boundaries, consistent with AD-1).
 */
export function downloadOscalProfile(profile: OscalProfile, baseline: Baseline): void {
  const json = JSON.stringify(profile, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseline}-odp-profile.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
