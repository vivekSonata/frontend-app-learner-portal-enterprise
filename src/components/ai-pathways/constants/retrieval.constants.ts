/**
 * Constants for catalog and career retrieval via Algolia.
 * These govern how searches are performed against the taxonomy and course catalogs.
 *
 * Used in: courseRetrieval.ts, careerRetrieval.ts, and catalogFacetService.ts.
 */

/** Maximum number of courses to include in a generated pathway. */
export const COURSE_RETRIEVAL_LIMIT = 5;

/**
 * Default RAG tags for Xpert Platform requests.
 * These tags scope the document retrieval to specific content domains.
 */
export const DEFAULT_XPERT_RAG_TAGS = ['discovery', 'edx-available-course'];

/** Maximum number of career paths to suggest to the user during intake. */
export const CAREER_RETRIEVAL_LIMIT = 10;

/** Minimum number of course results required before stopping the retrieval ladder. */
export const MIN_RESULTS_THRESHOLD = 3;

/** Maximum number of required skills to include as optionalFilters in career search. */
export const CAREER_REQUIRED_OPTIONAL_FILTER_LIMIT = 4;

/** Maximum number of preferred skills to include as optionalFilters in career search (excluded for beginners). */
export const CAREER_PREFERRED_OPTIONAL_FILTER_LIMIT = 2;

/** Maximum number of broad-anchor skills to use as hard facetFilters in course retrieval. */
export const MAX_STRICT_SKILLS = 4;

/** Maximum number of boost skills (role_differentiator + narrow_signal) to use as optionalFilters. */
export const MAX_BOOST_SKILLS = 8;

/** Reduced strict-skill cap for beginner learners (fewer hard filters = broader results). */
export const BEGINNER_MAX_STRICT_SKILLS = 3;

/** Maximum number of facet values to fetch from Algolia (to ensure high coverage). */
export const MAX_VALUES_PER_FACET = 1000;

/** Algolia filter string to restrict results to courses. */
export const CONTENT_TYPE_COURSE = 'content_type:course';

/**
 * Mapping of internal facet identifiers to Algolia index field names.
 */
export const FACET_FIELDS = {
  /** Primary skill name field in the catalog. */
  SKILL_NAMES: 'skill_names',
  /** Alternative skill name field (often used in nested objects). */
  SKILLS_DOT_NAME: 'skills.name',
  /** High-level topical categories. */
  SUBJECTS: 'subjects',
  /** Difficulty level (e.g., Beginner, Advanced). */
  LEVEL_TYPE: 'level_type',
  /** Content provider names. */
  PARTNERS_NAME: 'partners.name',
  /** Security scoping field for enterprise catalogs. */
  ENTERPRISE_CATALOG_QUERY_UUIDS: 'enterprise_catalog_query_uuids',
  /** Industry names (used in the taxonomy index). */
  INDUSTRY_NAMES: 'industry_names',
  /** Data sources (used in the taxonomy index). */
  JOB_SOURCES: 'job_sources',
} as const;

/**
 * Human-readable labels for the stages of the progressive search "ladder".
 */
export const RETRIEVAL_LADDER_STEPS = {
  /** Hybrid: broad-anchor facetFilters + boost optionalFilters + query. */
  STRICT: 'Hybrid Broad (Facets + Boosts)',
  /** Text + boost optionalFilters only, no facetFilters. */
  BOOST: 'Boosted Text Fallback',
  /** Text fallback: career title as query, no skill filters. */
  QUERY_ALTERNATE: 'Career Text Fallback',
  /** Broadest: empty query scoped to enterprise catalog only. */
  FALLBACK: 'Scope Only Fallback',
} as const;
