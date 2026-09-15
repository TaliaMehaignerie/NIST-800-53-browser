import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content Collection schemas — the contract the browse UI is written against.
 *
 * Architecture spine AD-2: `scripts/ingest.mjs` is the only code path allowed
 * to read raw OSCAL. Its committed output under `src/content/` is the single
 * source of truth every page, island, and the CI build reads. These schemas
 * are what Astro validates that output against at build time, so a drifting
 * ingestion run fails the build instead of shipping a half-broken site.
 *
 * Location note: the spec's Code Map and the spine's Structural Seed both name
 * `src/content/config.ts`. Astro 7 hard-errors on that path
 * (LegacyContentConfigError) before any build work starts, so this file lives
 * at `src/content.config.ts` — the only location Astro 7 accepts. Nothing else
 * moves: the data still sits under `src/content/{controls,families,meta}/`
 * exactly as the Code Map specifies.
 *
 * Entry ids come from each file's `slug` field (the glob loader prefers
 * `data.slug`), which `scripts/ingest.mjs` produces via `src/utils/slugify.ts`
 * (AD-4). Filenames match, so `src/content/controls/ac-2-1.json` is entry
 * `ac-2-1` in the `controls` collection.
 */

/** The four NIST baselines, in the order the UI presents them. */
const baseline = z.enum(['low', 'moderate', 'high', 'privacy']);

/**
 * One node of a Control/Enhancement statement.
 *
 * Recursive, and prose sits *before* children, because 122 catalog entries
 * carry prose AND sub-parts on the same node (e.g. AC-2 (d) "Specify:" with
 * items 1-3 beneath it). Flattening would reorder the text and break AD-5's
 * verbatim-fidelity rule.
 */
const statementNode = z.object({
  /** OSCAL `label` prop for the node — `"a."`, `"1."` — or null for the root. */
  label: z.string().nullable(),
  /** Verbatim OSCAL prose, `{{ insert: param, … }}` placeholders intact (AD-5). */
  prose: z.string().nullable(),
  get children() {
    return z.array(statementNode);
  },
});

/** An OSCAL organization-defined parameter declared by this entry. */
const param = z.object({
  /** OSCAL param id, as referenced by `{{ insert: param, <id> }}` in prose. */
  id: z.string(),
  /** Human-readable placeholder phrase, e.g. "time period". Null when the param is a `select`. */
  label: z.string().nullable(),
  /** Assignment choices, when the param is a selection rather than free text. */
  select: z
    .object({
      howMany: z.string().nullable(),
      choice: z.array(z.string()),
    })
    .nullable(),
  /** OSCAL `guidelines` prose for the assignment. */
  guidelines: z.array(z.string()),
});

/**
 * Controls and Enhancements are siblings in one collection (AD-2): one entry
 * per Control, one per Enhancement, distinguished by `kind`. Enhancements get
 * no route of their own — they render as fragments on the parent Control page
 * (AD-4) — but they are distinct entities with their own baseline membership.
 */
const controls = defineCollection({
  loader: glob({ base: './src/content/controls', pattern: '**/*.json' }),
  schema: z.object({
    /** OSCAL-native id: `ac-2`, `ac-2.1`. */
    id: z.string(),
    /** URL/filename slug from `slugify()` (AD-4): `ac-2`, `ac-2-1`. */
    slug: z.string(),
    /** Canonical uppercase display form (AD-4): `AC-2`, `AC-2(1)`. Never used as a slug. */
    label: z.string(),
    kind: z.enum(['control', 'enhancement']),
    /** Slug of the parent Control for an enhancement; null for a Control. */
    parentSlug: z.string().nullable(),
    /** Slugs of this Control's enhancements, in catalog order. Empty for an enhancement. */
    enhancementSlugs: z.array(z.string()),
    title: z.string(),
    /** Uppercase family code, e.g. `AC`. Joins to the `families` collection's `code`. */
    familyCode: z.string(),
    /** OSCAL `sort-id` prop, e.g. `ac-02.01` — the catalog's own ordering key. */
    sortId: z.string(),
    withdrawn: z.boolean(),
    /**
     * Targets a withdrawn entry was folded into, in OSCAL link order, stripped
     * to their control id (`#ac-2_smt.k` -> `ac-2`). Usually control ids; SA-12
     * points at the `sr` family. Empty when NIST withdrew without a successor.
     */
    incorporatedInto: z.array(z.string()),
    /**
     * Baselines this exact entry belongs to, computed by id presence in each
     * resolved profile (AD-2). An Enhancement never inherits its parent's
     * baselines — NIST routinely includes a Control without all of its
     * enhancements.
     */
    baselines: z.array(baseline),
    /** Statement tree; empty for withdrawn entries NIST left without one. */
    statement: z.array(statementNode),
    /** NIST "Discussion" prose. Ingested ahead of any capability that renders it. */
    guidance: z.string().nullable(),
    params: z.array(param),
    /** OSCAL `links[rel="related"]` targets as OSCAL-native ids, in catalog order. */
    related: z.array(z.string()),
  }),
});

/** One entry per Control Family — the top level of the FR-1 browse tree. */
const families = defineCollection({
  loader: glob({ base: './src/content/families', pattern: '**/*.json' }),
  schema: z.object({
    /** OSCAL group id, already slug-shaped: `ac`. Used as the `/families/{slug}` segment. */
    slug: z.string(),
    /** Uppercase family code: `AC`. */
    code: z.string(),
    /** Family title: "Access Control". */
    name: z.string(),
    /** Slugs of the family's Controls, in catalog order. */
    controlSlugs: z.array(z.string()),
    controlCount: z.number().int(),
    enhancementCount: z.number().int(),
  }),
});

/**
 * AD-2's singleton provenance entry — provenance lives here once, not
 * duplicated onto every Control. `layouts/BaseLayout.astro` is the only
 * renderer of it (AD-5).
 */
const meta = defineCollection({
  loader: glob({ base: './src/content/meta', pattern: '**/*.json' }),
  schema: z.object({
    catalogTitle: z.string(),
    /** NIST catalog version, e.g. `5.2.0`. */
    catalogVersion: z.string(),
    /** OSCAL model version the source file conforms to, e.g. `1.2.2`. */
    oscalVersion: z.string(),
    /** Catalog `last-modified`, verbatim from OSCAL metadata (ISO 8601). */
    lastModified: z.string(),
    /** Null until the CAP-4 ISO 27001 crosswalk is hand-transcribed. */
    crosswalkTranscribedAt: z.string().nullable(),
    counts: z.object({
      families: z.number().int(),
      controls: z.number().int(),
      enhancements: z.number().int(),
    }),
    baselineCounts: z.object({
      low: z.number().int(),
      moderate: z.number().int(),
      high: z.number().int(),
      privacy: z.number().int(),
    }),
  }),
});

export const collections = { controls, families, meta };
