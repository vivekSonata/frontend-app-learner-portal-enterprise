/**
 * Feature-local types for the AI Pathways feature.
 * This file serves as the central hub for types that bridge the UI,
 * AI services (Xpert), and retrieval layers (Algolia).
 */

import { CatalogSkillMatch } from './translationContracts';

/**
 * Defines the lifecycle of a course within a learning pathway.
 */
export type CourseStatus = 'completed' | 'in_progress' | 'not_started';

/**
 * Represents a single educational item in a personalized pathway.
 * This is the final UI-ready shape after enrichment and mapping.
 */
export interface PathwayCourse {
  /** Unique identifier for the course. */
  id?: string;
  /** Primary title of the course. */
  title: string;
  /** Difficulty level (e.g., 'Beginner', 'Intermediate'). */
  level: string;
  /** List of key skills covered by this course. */
  skills: string[];
  /** AI-generated reasoning for why this course was included. */
  reasoning?: string;
  /** Current completion status for the learner. */
  status: CourseStatus;
  /** Sort order within the pathway. */
  order: number;
  /** Brief summary of the course content. */
  shortDescription?: string;
  /** URL to the course thumbnail or banner image. */
  imageUrl?: string;
  /** Direct link to the course detail page. */
  marketingUrl?: string;
}

/**
 * The top-level collection of recommended courses forming a pathway.
 */
export interface LearningPathway {
  /** Ordered list of courses in the pathway. */
  courses: PathwayCourse[];
}

/**
 * Standard learner difficulty tiers.
 */
export type LearnerLevel = 'introductory' | 'intermediate' | 'advanced';

/**
 * Preferred intensity of the learning journey.
 */
export type TimeCommitment = 'short' | 'medium' | 'long';

/**
 * Extracted search intent derived from the learner's natural language input.
 * This is the structured output of the Intent Extraction stage.
 */
export interface XpertIntent {
  /** A concise, optimized query string for search. */
  condensedQuery: string;
  /** List of target job roles or titles. */
  roles: string[];
  /** Core skills required to achieve the goal. */
  skillsRequired: string[];
  /** Complementary skills that are nice to have. */
  skillsPreferred: string[];
  /** Target industries. */
  industries: string[];
  /** Geographic or platform job sources. */
  jobSources: string[];
  /** Normalized learner level. */
  learnerLevel: LearnerLevel;
  /** Normalized time commitment. */
  timeCommitment: TimeCommitment;
  /** List of tags or terms to explicitly exclude from results. */
  excludeTags: string[];
  /** Discovery data from Xpert RAG retrieval. */
  discovery?: any;
  /** Whether discovery RAG was used during the request. */
  wasDiscoveryUsed?: boolean;
}

/**
 * Represents a potential career path matching the user's profile.
 * Returned from the Career Retrieval stage (taxonomy search).
 */
export interface CareerOption {
  /** Professional title. */
  title: string;
  /** Similarity score (0-100) relative to the learner's profile. */
  percentMatch: number;
  /** Key skills associated with this career. */
  skills: string[];
  /** Industries where this career is prevalent. */
  industries?: string[];
  /** Sources where this job is frequently found. */
  jobSources?: string[];
}

/**
 * UI model for displaying a career opportunity card.
 * Derived from a TaxonomyResult.
 */
export interface CareerCardModel {
  /** Unique ID from the taxonomy index. */
  id: string;
  /** Professional title. */
  title: string;
  /** Summary of the role and its relevance. */
  description: string;
  /** Top skills for this role. */
  skills: string[];
  /** Primary industries. */
  industries: string[];
  /** Related job titles. */
  similarJobs: string[];
  /** Data sources for this job entry. */
  jobSources: string[];
  /** Labor market insights (optional). */
  marketData?: {
    medianSalary?: number;
    uniquePostings?: number;
  };
  /** Explanation of why this career matches the user's input. */
  reasoning?: string;
  /** The original raw taxonomy record. */
  raw: TaxonomyResult;
  /** Percentage match score between user input and career data. */
  percentMatch: number;
}

/**
 * UI model for displaying a course card within the results list.
 */
export interface CourseCardModel {
  /** Unique identifier. */
  id: string;
  /** Course name. */
  title: string;
  /** Difficulty tier. */
  level: string | null;
  /** List of primary skills taught. */
  skills: string[];
  /** Direct link to course. */
  marketingUrl: string | null;
  /** Course thumbnail image. */
  imageUrl: string | null;
  /** Short summary of course content. */
  shortDescription: string | null;
  /** Relative rank or order in the recommendation list. */
  order: number;
  /** Recommendation status within the current context. */
  status: 'recommended' | 'optional' | 'unavailable';
  /** Original search hit data. */
  raw?: unknown;
}

/**
 * Summarizes the user's input and matched career opportunities.
 * This is the intermediate state shown to the user before pathway generation.
 */
export interface LearnerProfile {
  /** Learner's full name or preferred name. */
  name?: string;
  /** AI-generated summary of the learner's situation. */
  overview: string;
  /** Primary professional objective. */
  careerGoal: string;
  /** Targeted sector or field. */
  targetIndustry: string;
  /** Relevant previous experience or education. */
  background: string;
  /** Internal or external drivers for learning. */
  motivation: string;
  /** Preferred learning modality (e.g., async, live). */
  learningStyle: string;
  /** Weekly time availability. */
  timeAvailable: string;
  /** Preference for earned credentials. */
  certificate: string;
  /** List of career paths that align with this profile. */
  careerMatches: CareerOption[];
}

/**
 * Raw intake form responses captured from the UI.
 * Used as input for the Preprocessing and Intent Extraction stages.
 */
export interface CreateLearnerProfileArgs {
  /** "What brings you here today?" response. */
  bringsYouHereRes: string;
  /** "What is your career goal?" response. */
  careerGoalRes: string;
  /** Learning style and preference response. */
  learningPrefRes: string;
  /** Previous experience summary. */
  backgroundRes: string;
  /** Target industry response. */
  industryRes: string;
  /** Weekly hour commitment response. */
  timeAvailableRes: string;
  /** Certificate importance response. */
  certificateRes: string;
}

/**
 * Detail for a specific skill found in the taxonomy index.
 */
export interface TaxonomySkill {
  name: string;
  type_name?: string;
  significance?: number;
  unique_postings?: number;
  external_id?: string;
  description?: string;
  info_url?: string;
}

/**
 * Industry-specific details from the taxonomy index.
 */
export interface TaxonomyIndustryDetail {
  name: string;
  skills?: string[];
}

/**
 * Labor market data for a job role in the taxonomy.
 */
export interface TaxonomyJobPosting {
  job_id?: number;
  median_salary?: number;
  median_posting_duration?: number;
  unique_postings?: number;
  unique_companies?: number;
}

/**
 * Raw record from the Algolia taxonomy index.
 */
export interface TaxonomyResult {
  /** Unique ID. */
  id?: string | number;
  /** Algolia-specific unique ID. */
  objectID?: string;

  /** Primary professional title. */
  name: string;
  /** General role description. */
  description?: string;
  /** Cross-reference identifier. */
  external_id?: string;

  /** List of associated industries. */
  industry_names?: string[];
  /** Sources where this job is listed. */
  job_sources?: string[];
  /** Related professional titles. */
  similar_jobs?: string[];
  /** Whether this role is available in consumer catalogs. */
  b2c_opt_in?: boolean;

  /** Associated skills. */
  skills?: TaxonomySkill[];
  /** Detailed industry mappings. */
  industries?: TaxonomyIndustryDetail[];
  /** Historical job posting data. */
  job_postings?: TaxonomyJobPosting[];

}

/**
 * A single filterable option derived from an Algolia facet.
 */
export interface FacetOption {
  /** Human-readable name. */
  label: string;
  /** Machine-readable value. */
  value: string;
  /** Frequency count in the current result set. */
  count: number;
  /** Whether this facet is currently selected. */
  isRefined?: boolean;
}

/**
 * Normalized UI-ready facets retrieved from the taxonomy index.
 */
export interface TaxonomyFacetBootstrap {
  'skills.name': { items: FacetOption[] };
  'industry_names': { items: FacetOption[] };
  'job_sources': { items: FacetOption[] };
  'name': { items: FacetOption[] };
}

/**
 * Filter state for the taxonomy/career search.
 */
export interface TaxonomyFilters extends TaxonomyFacetBootstrap {}

/**
 * Context required for fetching deterministic facets from Algolia.
 */
export interface FacetBootstrapContext {
  /** Scopes the search to a specific enterprise customer. */
  enterpriseCustomerUuid?: string;
  /** List of catalogs to include in the search. */
  searchCatalogs?: string[];
  /** Mapping of catalog IDs to their search-specific query IDs. */
  catalogUuidsToCatalogQueryUuids?: Record<string, string>;
  /** User's preferred locale. */
  locale?: string;
  /** Whether to use a restricted API key for security. */
  shouldUseSecuredAlgoliaApiKey?: boolean;
}

/**
 * Filter and sort state for the Learning Pathway results view.
 */
export interface PathwayFilters {
  /** Text-based filter for course titles. */
  searchQuery: string;
  /** Lifecycle status filter. */
  statusFilter: CourseStatus | 'all';
  /** Difficulty level filter. */
  levelFilter: string | 'all';
  /** Primary sort dimension. */
  sortKey: 'order' | 'title' | 'status' | 'level';
  /** Sort direction. */
  sortOrder: 'asc' | 'desc';
}

/**
 * Trace produced by `careerRetrievalService.searchCareers`, capturing the exact
 * Algolia request parameters and a summary of returned career results.
 * Surfaced in the DebugConsole "Stage 3: Career Retrieval" panel.
 */
export interface CareerRetrievalTrace {
  /** The search query string sent to Algolia. */
  query: string;
  /** Maximum number of results requested. */
  hitsPerPage: number;
  /** Algolia hard-filter expression (industries, job sources, excluded tags). */
  filters?: string;
  /** Algolia optional-filter strings used to boost required and preferred skills. */
  optionalFilters?: string[];
  /** Required skills that passed malformed-compound filtering and were sent as boost signals. */
  requiredSkillFilters?: string[];
  /** Preferred skills that passed filtering and learner-level checks and were sent as lower-weight boosts. */
  preferredSkillFilters?: string[];
  /** Skills that were excluded from the request, with the reason for each exclusion. */
  droppedSkillInputs?: Array<{ skill: string; reason: string }>;
  /** Learner difficulty level passed through from intent extraction. */
  learnerLevel?: string;
  /** Summary of the top career results returned by Algolia. */
  resultSummaries?: Array<{
    /** Unique career ID from the taxonomy index. */
    id: string;
    /** Professional role title. */
    title: string;
    /** Total number of skills associated with this career in the taxonomy. */
    skillCount: number;
    /** Top 5 skills sorted by Lightcast significance (most in-demand first). */
    topSkills?: Array<{ name: string; significance?: number; uniquePostings?: number; typeName?: string }>;
    /** Industries where this career is prevalent. */
    industries?: string[];
    /** Median annual salary from Lightcast job posting data. */
    medianSalary?: number;
    /** Number of unique job postings for this role. */
    uniquePostings?: number;
  }>;
}

/**
 * Performance and success metrics for a single pipeline stage.
 */
export interface StageMetrics {
  /** Time taken in milliseconds. */
  durationMs: number;
  /** Whether the stage finished successfully. */
  success: boolean;
  /** Error message if success is false. */
  error?: string;
}

/**
 * Summary of catalog facets used during the translation stage.
 * Used for debugging and tracing translation decisions.
 */
export interface FacetSnapshotTrace {
  skillNamesCount: number;
  skillsDotNameCount: number;
  subjectsCount: number;
  levelTypeCount: number;
  partnersNameCount: number;
  sampleSkillNames: string[];
  sampleSubjects: string[];
}

/**
 * Per-skill entry in the tiering trace: records how a signal was classified and
 * what catalog match (if any) it was assigned to.
 */
export interface TieredSkillTrace {
  name: string;
  normalizedName?: string;
  source?: 'intent_required' | 'intent_preferred' | 'career_taxonomy';
  tier?: import('./translationContracts').RetrievalSkillTier;
  score?: number;
  significance?: number;
  uniquePostings?: number;
  typeName?: string;
  catalogSkill?: string;
  catalogField?: string;
  matchMethod?: 'exact' | 'alias' | 'xpert' | 'none';
  /** Final routing decision: strict facet filter, optional boost, noise-dropped, or unmatched. */
  decision?: 'strict' | 'boost' | 'dropped' | 'unmatched';
  reasons?: string[];
}

/**
 * Traces the outcome of deterministic mapping from taxonomy to catalog facets.
 * Identifies which terms matched exactly or via aliases.
 */
export interface RulesFirstMappingTrace {
  /** Total number of terms processed. */
  termsConsidered: number;
  /** Number of successful exact matches. */
  exactMatchCount: number;
  /** Number of successful alias matches. */
  aliasMatchCount: number;
  /** Number of terms that failed to map deterministically. */
  unmatchedCount: number;
  /** List of exact matches found. */
  exactMatches: string[];
  /** List of alias matches found. */
  aliasMatches: string[];
  /** List of terms that remain unmatched. */
  unmatched: string[];
  /** Catalog skills classified as broad_anchor (used as strict facetFilters). */
  broadAnchorMatches?: string[];
  /** Catalog skills classified as role_differentiator (broad boosting signals). */
  roleDifferentiatorMatches?: string[];
  /** Catalog skills classified as narrow_signal (specific tool/language boosting signals). */
  narrowSignalMatches?: string[];
  /** Catalog skills classified as role_differentiator or narrow_signal (combined boost set). */
  boostMatches?: string[];
  /** Skills classified as noise and excluded from retrieval. */
  noiseDropped?: string[];
  /** Number of broad_anchor candidates found before catalog matching. */
  strictCandidateCount?: number;
  /** Number of role_differentiator + narrow_signal candidates found before catalog matching. */
  boostCandidateCount?: number;
  /** Full tiering trace for all input signals with catalog match and routing decision. */
  tieringTrace?: TieredSkillTrace[];
}

/**
 * A skill signal entering the tiering pipeline, before tier classification.
 * Aggregated from intent extraction output (`intent_required`, `intent_preferred`)
 * and the selected career's Lightcast taxonomy record (`career_taxonomy`).
 */
export interface SkillSignal {
  /** The skill name as provided by the source. */
  name: string;
  /** Where this signal originated in the pipeline. */
  source: 'intent_required' | 'intent_preferred' | 'career_taxonomy';
  /** Lightcast significance metric — higher values indicate the skill is more commonly required. */
  significance?: number;
  /** Number of unique job postings that require this skill (from Lightcast). */
  uniquePostings?: number;
  /** Lightcast skill category (e.g., 'Common Skill', 'Specialized Skill', 'Software Product'). */
  typeName?: string;
}

/**
 * A skill signal after classification by `skillTiering.tierSkillSignal`.
 * Extends SkillSignal with a routing tier, a composite score, and the reasoning
 * that drove the classification — all surfaced in the TieredSkillTrace debug output.
 */
export interface TieredSkillSignal extends SkillSignal {
  /** The retrieval tier that determines how this skill is used in Algolia queries. */
  tier: import('./translationContracts').RetrievalSkillTier;
  /** Human-readable explanations for the tier assignment (e.g., 'lightcast-type=Common Skill'). */
  reasons: string[];
  /** Lowercased, trimmed version of the skill name — used for deduplication and catalog lookup. */
  normalizedName: string;
  /** Composite relevance score (0–100) within its tier, boosted by Lightcast significance. */
  score: number;
}

/**
 * Traces the final output of the catalog translation stage.
 * Splits matched skills into strict broad anchors (facetFilters) and boost signals (optionalFilters).
 *
 * courseSearchMode:
 *   - hybrid-broad: primary mode — broad anchors as facetFilters + boosts as optionalFilters
 *   - facet-first: strict-only (legacy, no boost signals)
 *   - text-boost: no strict anchors, boost signals only as optionalFilters
 *   - text-fallback: no matched skills, fall back to careerTitle text search
 */
export interface CatalogTranslationTrace {
  /** Broad query terms derived from intentRequiredSkills or broad anchor catalog names. */
  query: string;
  /** Text fallback queries (e.g., [careerTitle]) used if facet steps find no results. */
  queryAlternates: string[];
  /** Count of broad anchor skills used as hard facet filters. */
  strictSkillCount: number;
  /** Count of boost skill filters (role_differentiator + narrow_signal). */
  boostSkillCount: number;
  /** Count of skills that could not be mapped and were dropped. */
  droppedSkillCount: number;
  /** Catalog skill values used as hard facet filters (broad anchors). */
  strictSkills: string[];
  /** Catalog skill values used as optional boost filters. */
  boostSkills: string[];
  /** Full CatalogSkillMatch entries for the strict filter set. */
  strictSkillFilters?: CatalogSkillMatch[];
  /** Full CatalogSkillMatch entries for the boost filter set. */
  boostSkillFilters?: CatalogSkillMatch[];
  /** Retrieval mode determined by the strict/boost split. */
  courseSearchMode: 'facet-first' | 'text-fallback' | 'hybrid-broad' | 'text-boost';
  /** Number of career skills that successfully mapped to catalog facets. */
  facetMatchCount: number;
  /** Ratio of matched skills to total input skills (0–1). */
  facetMatchRate: number;
  /** Human-readable reason for how strictSkillFilters were selected. */
  strictSelectionReason?: string;
  /** Human-readable reason for how boostSkillFilters were selected. */
  boostSelectionReason?: string;
  /** Skills from the taxonomy that had no catalog match. */
  droppedTaxonomySkills?: string[];
  /** Count of matched skills per tier. */
  tierCounts?: Partial<Record<import('./translationContracts').RetrievalSkillTier, number>>;
  /** What drove the query value. */
  querySource?: 'intent_required' | 'strict_filters' | 'career_title' | 'fallback';
  /** Learner level passed into the translation options. */
  learnerLevel?: string;
}

/**
 * Trace produced by the `rerank()` function inside `courseRetrievalService`.
 * Records the scoring inputs and output order for every course evaluated
 * in a given retrieval ladder step. Surfaced in the DebugConsole under each
 * ladder attempt when `rerankApplied` is true.
 */
export interface CourseRerankTrace {
  /** Number of courses evaluated before reranking. */
  inputCount: number;
  /** Number of courses in the output (same as inputCount — reranking never drops courses). */
  outputCount: number;
  /** Learner difficulty level used to compute level-match bonuses. */
  learnerLevel?: string;
  /** Per-course scoring breakdown, ordered by finalRank ascending. */
  courseScores?: Array<{
    /** Algolia objectID. */
    objectID: string;
    /** Course title. */
    title?: string;
    /** Zero-based rank before reranking (Algolia's original relevance order). */
    originalRank: number;
    /** Zero-based rank after reranking. */
    finalRank: number;
    /** Composite score: strictSkill matches × 10 + boostSkill matches × 3 + level bonus. */
    score: number;
    /** Strict-filter skills found in this course's skill_names or skills.name fields. */
    matchedStrictSkills?: string[];
    /** Boost-filter skills found in this course's skill fields. */
    matchedBoostSkills?: string[];
    /** The course's difficulty level as indexed in Algolia. */
    levelType?: string;
    /** How closely the course level aligns with the learner's level. */
    levelCompatibility?: 'matched' | 'near' | 'mismatch' | 'unknown';
  }>;
}

/**
 * Captures a single search attempt in the course retrieval ladder.
 * The "ladder" tries progressively broader searches until hits are found.
 */
export interface RetrievalLadderAttempt {
  /** The step number (1 is most specific, 4 is broadest). */
  step: 1 | 2 | 3 | 4;
  /** Human-readable label for this attempt step. */
  label: string;
  /** Retrieval mode used for this attempt. */
  searchMode?: 'hybrid-broad' | 'boosted-text' | 'career-text' | 'scope-only' | 'error';
  /** The exact query used. */
  query?: string;
  /** Applied facet filters. */
  facetFilters?: unknown;
  /** Applied optional (boosting) filters. */
  optionalFilters?: unknown;
  /** Broad anchor skills used as facet filters in this step. */
  strictSkillsUsed?: string[];
  /** Boost skills used as optional filters in this step. */
  boostSkillsUsed?: string[];
  /** Number of courses found. */
  hitCount: number;
  /** Whether this attempt was selected as the "winner" for the pathway. */
  winner: boolean;
  /** Whether post-retrieval reranking was applied to this attempt's results. */
  rerankApplied?: boolean;
  /** Rerank scoring trace (present when rerankApplied is true). */
  rerankTrace?: CourseRerankTrace;
  /** Full Algolia request params for this attempt. */
  requestParams?: Record<string, unknown>;
  /** The actual course hits returned for this step. */
  hits?: CourseRetrievalHit[];
}

/**
 * Traces all attempts made during the retrieval ladder phase.
 */
export interface RetrievalLadderTrace {
  /** History of search attempts. */
  attempts: RetrievalLadderAttempt[];
  /** The step number that successfully provided results. */
  winnerStep: number | null;
}

/**
 * Content partner or provider information.
 */
export interface Partner {
  name?: string;
  logo_image_url?: string;
}

/**
 * User's access rights or pricing for a specific course.
 */
export interface Entitlement {
  mode?: string;
  price?: string;
  currency?: string;
  sku?: string;
  expires?: string | null;
}

/**
 * Metadata for a specific instance/run of a course.
 */
export interface AdvertisedCourseRun {
  key?: string;
  pacing_type?: string;
  availability?: string;
  start?: string | null;
  end?: string | null;
  min_effort?: number | null;
  max_effort?: number | null;
  weeks_to_complete?: number | null;
  content_price?: number | null;
  is_active?: boolean;
}

/**
 * Raw course record retrieved from the Algolia catalog index.
 */
export interface CourseRetrievalHit {
  /** Unique Algolia ID. */
  objectID: string;
  /** Internal course key. */
  key?: string;
  /** System UUID. */
  uuid?: string;
  /** Course name. */
  title: string;
  /** Brief summary of content. */
  short_description?: string;
  /** Link to course detail. */
  marketing_url?: string;
  /** Small thumbnail image. */
  card_image_url?: string;
  /** Large banner image. */
  image_url?: string;
  /** Unprocessed image URL. */
  original_image_url?: string;
  /** List of availability modes (e.g., 'Always available'). */
  availability?: string[];
  /** Difficulty level. */
  level_type?: string;
  /** Primary language of instruction. */
  language?: string;
  /** List of primary skills taught. */
  skill_names?: string[];
  /** High-level categories. */
  subjects?: string[];
  /** Providing institutions or companies. */
  partners?: Partner[];
  /** Programs this course belongs to. */
  programs?: string[];
  /** Titles of associated programs. */
  program_titles?: string[];
  /** Type of content (e.g., 'course', 'specialization'). */
  content_type?: string;
  /** modality of learning. */
  learning_type?: string;
  learning_type_v2?: string;
  course_type?: string;
  /** User's access entitlements. */
  entitlements?: Entitlement[];
  /** Details on the current/next run. */
  advertised_course_run?: AdvertisedCourseRun;
}

/**
 * Records the interception and outcome for a single Xpert call.
 * This is used for debugging and prompt engineering within the prototype.
 */
export interface PromptDebugEntry {
  /** Human-readable label (e.g. "Intent Extraction"). */
  label: string;
  /** The prompt bundle as it was originally built. */
  original: XpertPromptBundle;
  /** The bundle that was actually sent (after user edits). */
  edited?: XpertPromptBundle;
  /** The user's interception decision. */
  decision: 'accepted' | 'rejected' | 'cancelled';
  /** ISO-8601 timestamp of the decision. */
  timestamp: string;
  /** Validation issues produced by the prompt validation service. */
  validationWarnings?: Array<{ severity: 'error' | 'warning'; code: string; message: string }>;
}

/**
 * Represents the complete state and trace of a pathway generation request.
 * This model is the primary data structure for the AI Pathways debug flow.
 */
export interface AIPathwaysResponseModel {
  /** Unique ID for the generation session. */
  requestId: string;
  /** Tags used in Xpert requests for RAG control. */
  tags?: string[];
  /** Discovery data from Xpert RAG retrieval. */
  discovery?: any;
  /** Whether discovery RAG was used during the request. */
  wasDiscoveryUsed?: boolean;
  /** Ordered list of prompt interception events. */
  promptDebug?: PromptDebugEntry[];
  /** Metrics and data for each stage of the generation pipeline. */
  stages: {
    /** Conversion of natural language input to structured intent. */
    intentExtraction: StageMetrics & {
      systemPrompt: string;
      rawResponse: string;
      parsedResponse: any;
      validationErrors: string[];
      repairPromptUsed: boolean;
      discovery?: any;
      wasDiscoveryUsed?: boolean;
    };
    /** Search for matching careers in the taxonomy index. */
    careerRetrieval: StageMetrics & {
      resultCount: number;
      trace?: CareerRetrievalTrace;
    };
    /** Capturing current catalog facets for translation. */
    catalogFacetSnapshot?: StageMetrics & {
      trace: FacetSnapshotTrace;
    };
    /** Initial mapping from taxonomy to catalog terms. */
    rulesFirstMapping?: StageMetrics & {
      trace: RulesFirstMappingTrace;
    };
    /** AI-driven translation of remaining taxonomy terms. */
    catalogTranslation?: StageMetrics & {
      trace: CatalogTranslationTrace;
      discovery?: any;
      wasDiscoveryUsed?: boolean;
    };
    /** Progressive search logic to find relevant courses. */
    retrievalLadder?: StageMetrics & {
      trace: RetrievalLadderTrace;
    };
    /** Execution of the final course searches. */
    courseRetrieval: StageMetrics & {
      resultCount: number;
      hits?: CourseRetrievalHit[];
      winnerStep?: number | null;
      selectedCourseIds?: string[];
      selectedCourseTitles?: string[];
      requestSummary?: {
        winningQuery?: string;
        winningFacetFilters?: unknown;
        winningOptionalFilters?: unknown;
      };
    };
    /** Final assembly and enrichment of the course pathway. */
    pathwayEnrichment: StageMetrics & {
      systemPrompt: string;
      rawResponse: string;
      discovery?: any;
      wasDiscoveryUsed?: boolean;
    };
  };
}

/**
 * Represents a single named segment of an AI system prompt.
 */
export type PromptPartLabel = 'base' | 'schema' | 'repair' | 'json_instruction';

/**
 * A component part of a structured prompt.
 */
export interface PromptPart {
  /** Identifier for the part's role. */
  label: PromptPartLabel;
  /** The actual text content. */
  content: string;
  /** Whether the user is allowed to edit this part in the debug console. */
  editable: boolean;
  /** Whether this part must be present for a valid prompt. */
  required: boolean;
}

/**
 * A structured bundle representing a complete system prompt.
 * Ensures consistent composition of multiple prompt segments.
 */
export interface XpertPromptBundle {
  /** Unique identifier for the bundle instance. */
  id: string;
  /** The pipeline stage this prompt belongs to. */
  stage: 'intentExtraction' | 'catalogTranslation' | 'pathwayEnrichment';
  /** Individual parts composing the prompt. */
  parts: PromptPart[];
  /** The final flattened string sent to the AI. */
  combined: string;
  /** Optional RAG control tags for the request. */
  tags?: string[];
}

/**
 * A single message in a conversation with Xpert.
 */
export interface XpertMessage {
  /** The sender's role. */
  role: 'user' | 'assistant' | 'tool';
  /** The message text. */
  content: string;
}

/**
 * Request shape for Xpert Platform message requests.
 */
export interface XpertMessageRequest {
  messages: XpertMessage[];
  systemMessage?: string;
  conversationId?: string;
  stream?: boolean;
  tags?: string[];
}

/**
 * The first message object returned by the Xpert `/v1/message` endpoint.
 * Parsed from `response.data[0]` by `xpertService.sendMessage`.
 */
export interface XpertMessageResponse {
  /** The AI-generated response text (typically JSON for structured calls). */
  content: string;
  /** The Xpert role identifier for this message (e.g., 'assistant'). */
  role: string;
  /** Discovery documents retrieved by Xpert RAG, if RAG was active for this call. */
  discovery?: any;
}

/**
 * Configuration for the Xpert backend service.
 */
export interface XpertServiceConfig {
  /** Client identifier for API authentication. */
  clientId: string;
  /** Root URL for the Xpert API. */
  baseUrl: string;
}

export * from './catalogFacet';
export * from './catalogTranslation';
export * from './translationContracts';
