import { CatalogFacetSnapshot } from './catalogFacet';
import { CatalogSkillMatch } from './translationContracts';
import type { LearnerLevel, TaxonomySkill } from './index';

/**
 * RulesFirstCandidates represents the result of the initial deterministic
 * translation of taxonomy terms into catalog-valid values.
 *
 * Pipeline context: Output of the 'rulesFirstMapping' stage.
 */
export interface RulesFirstCandidates {
  exactMatches: string[];
  aliasMatches: string[];
  unmatched: string[];
  exactSkillFilters: CatalogSkillMatch[];
  aliasSkillFilters: CatalogSkillMatch[];
}
/**
 * Input payload for the rules-first translation helper.
 * Combines the target career data with the current catalog snapshot.
 */
export interface TaxonomyTranslationInput {
  /** The professional title selected by the user. */
  careerTitle: string;
  /** List of skills extracted from the taxonomy for this career. */
  skills: string[];
  /** Raw Lightcast skill objects with significance and type metadata. */
  skillDetails?: TaxonomySkill[];
  /** Broad career-anchor skills from searchIntent.skillsRequired. */
  intentRequiredSkills?: string[];
  /** Tool/language/framework skills from searchIntent.skillsPreferred. */
  intentPreferredSkills?: string[];
  /** Learner experience level from searchIntent.learnerLevel. */
  learnerLevel?: LearnerLevel;
  /** List of industries associated with the career. */
  industries: string[];
  /** List of similar job titles from the taxonomy. */
  similarJobs: string[];
  /** The source of truth for valid catalog facets. */
  facetSnapshot: CatalogFacetSnapshot;
}
