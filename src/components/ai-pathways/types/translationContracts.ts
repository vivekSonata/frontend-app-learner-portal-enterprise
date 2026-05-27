/**
 * Algolia facet field names that hold skill data in the course catalog index.
 * Both fields are checked during exact matching; `skill_names` is preferred
 * for facetFilter construction when both are present.
 */
export type CatalogSkillField = 'skill_names' | 'skills.name';

/**
 * Routing tier assigned to each skill signal during catalog translation.
 *
 * - `broad_anchor`:       Broad career-area terms used as hard facetFilters.
 *                         Derived from `intent_required` or high-significance
 *                         Common Skills from Lightcast. Maximises catalog recall.
 * - `role_differentiator`: Role-specific skills used as optional boost signals.
 *                         Derived from `Common Skill` or `Certification` Lightcast types.
 * - `narrow_signal`:      Specific tools, languages, or software products used
 *                         as optional boost signals. Derived from `intent_preferred`,
 *                         `Software Product`, or `Specialized Skill` Lightcast types.
 * - `noise`:              Malformed compounds or extremely rare skills excluded from
 *                         retrieval entirely.
 */
export type RetrievalSkillTier = 'broad_anchor' | 'role_differentiator' | 'narrow_signal' | 'noise';

/**
 * A mapping between a single taxonomy skill and its validated catalog counterpart.
 *
 * Produced by `catalogTranslationRules.translateTaxonomyToCatalog` and consumed by
 * `catalogTranslationService.processTranslation` to build Algolia query parameters.
 * The `tier` field determines whether the match becomes a strict facetFilter
 * (broad_anchor) or an optional boost (role_differentiator / narrow_signal).
 */
export interface CatalogSkillMatch {
  /** The original skill name from the taxonomy / intent. */
  taxonomySkill: string;
  /** The validated skill name as it exists in the Algolia catalog index. */
  catalogSkill: string;
  /** The Algolia field where the catalog skill was found. */
  catalogField: CatalogSkillField;
  /** How the match was found: exact case-insensitive match, curated alias, AI-generated, or unmatched. */
  matchMethod: 'exact' | 'alias' | 'xpert' | 'none';
  /** Retrieval tier assigned by the skill tiering stage. */
  tier?: RetrievalSkillTier;
  /** Tier score (0–100) reflecting confidence and significance. */
  score?: number;
  /** Original signal source that produced this skill. */
  source?: 'intent_required' | 'intent_preferred' | 'career_taxonomy';
  /** Lightcast significance metric for this skill (higher = more commonly required). */
  significance?: number;
  /** Scoring reasons from the tiering stage (e.g., 'lightcast-type=Common Skill'). */
  reasons?: string[];
}

/**
 * Tracks the origin and mapping outcome for each taxonomy skill that entered
 * the translation pipeline. Used by the DebugConsole to show how each skill
 * was grounded into the course catalog.
 */
export interface SkillProvenance {
  /** The original skill name from the taxonomy or intent. */
  taxonomySkill: string;
  /** The matched catalog skill value, if a mapping was found. */
  catalogMatch?: string;
  /** The Algolia field where the match was found. */
  catalogField?: CatalogSkillField;
  /** How the match was resolved. */
  matchMethod: 'exact' | 'alias' | 'xpert' | 'none';
}

/**
 * The grounded search intent passed to the course retrieval ladder.
 *
 * Produced by `catalogTranslationService.processTranslation` after the rules-first
 * and optional AI translation stages. It contains the exact Algolia query parameters
 * that will be used to search for courses.
 */
export interface CatalogSearchIntent {
  /** Broad query terms derived from `intentRequiredSkills` or broad anchor catalog names.
   *  An empty string signals that strict facetFilters alone should drive the search. */
  query: string;
  /** Text-only fallback queries (e.g., the career title) for retrieval ladder steps 3+. */
  queryAlternates: string[];
  /** Broad anchor skills used as hard Algolia facetFilters. These must match for a course to be returned. */
  strictSkillFilters: CatalogSkillMatch[];
  /** Role-differentiator and narrow-signal skills used as Algolia optionalFilters to boost ranking. */
  boostSkillFilters: CatalogSkillMatch[];
  /** Taxonomy skills that had no catalog match and were excluded from retrieval. */
  droppedTaxonomySkills: string[];
}

/**
 * Complete output of the catalog translation flow, combining the grounded
 * search intent with per-skill provenance metadata and learner context.
 */
export interface CatalogTranslation extends CatalogSearchIntent {
  /** Per-skill mapping history used for debug visibility and audit. */
  skillProvenance: SkillProvenance[];
  /** Learner difficulty level forwarded from intent extraction for post-retrieval reranking. */
  learnerLevel?: string;
}
