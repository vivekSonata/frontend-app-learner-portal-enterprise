import { SearchIndex } from 'algoliasearch/lite';
import AlgoliaFilterBuilder from '../../AlgoliaFilterBuilder/AlgoliaFilterBuilder';
import {
  XpertIntent,
  CareerCardModel,
  TaxonomyResult,
  CareerRetrievalTrace,
} from '../types';

import {
  CAREER_RETRIEVAL_LIMIT,
  FACET_FIELDS,
  CAREER_REQUIRED_OPTIONAL_FILTER_LIMIT,
  CAREER_PREFERRED_OPTIONAL_FILTER_LIMIT,
} from '../constants';
import { isMalformedCompound } from './skillTiering';

/**
 * Trims and coerces a nullable value to a clean string.
 *
 * @param value The raw input value.
 * @returns The trimmed string, or an empty string if null/undefined.
 */
const normalizeString = (value?: string | null): string => (value || '').trim();

/**
 * Wraps a skill or taxonomy value in double-quotes and escapes any embedded quotes
 * so it can be passed safely as an Algolia facet filter value.
 *
 * @param value The raw facet value to escape.
 * @returns A double-quoted, escape-safe string.
 */
const quoteFacetValue = (value: string): string => `"${value.replace(/"/g, '\\"')}"`;

/**
 * Builds an optional filter string with an optional relevance score (boosting).
 *
 * @param skill The skill name to filter/boost.
 * @param score Optional boosting score.
 * @returns A formatted Algolia optional filter string.
 */
const buildOptionalSkillFilter = (skill: string, score?: number): string => {
  const quotedSkill = `${FACET_FIELDS.SKILLS_DOT_NAME}:${quoteFacetValue(skill)}`;

  if (!score) {
    return quotedSkill;
  }

  return `${quotedSkill}<score=${score}>`;
};

/**
 * Type-guard that returns true when the trimmed value is a non-empty string.
 *
 * @param value The value to test.
 * @returns Whether the value is a non-empty string after trimming.
 */
const isNonEmptyString = (value?: string | null): value is string => Boolean(normalizeString(value));

/**
 * Normalises, filters, and deduplicates a list of raw skill or filter strings.
 * Removes empty, null, and repeat values while preserving first-occurrence order.
 *
 * @param values Raw values which may include nulls, undefineds, or duplicates.
 * @returns A clean array of unique, non-empty strings.
 */
const dedupeStrings = (values: Array<string | undefined | null>): string[] => {
  const seen = new Set<string>();

  return values
    .map(normalizeString)
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
};

/**
 * Normalizes a raw Algolia taxonomy hit into a UI-ready CareerCardModel.
 *
 * @param hit The raw record retrieved from the Algolia taxonomy index.
 * @returns A structured model for the Career Match card.
 */
const mapTaxonomyResultToCareerCard = (hit: TaxonomyResult): CareerCardModel => ({
  id: String(hit.id || hit.objectID || ''),
  title: hit.name || '',
  description: hit.description || '',
  skills: (hit.skills || []).map((skill) => skill.name).filter(Boolean),
  industries: hit.industry_names || [],
  similarJobs: hit.similar_jobs || [],
  jobSources: hit.job_sources || [],
  marketData: {
    medianSalary: hit.job_postings?.[0]?.median_salary,
    uniquePostings: hit.job_postings?.[0]?.unique_postings,
  },
  raw: hit,
  percentMatch: 0.95,
});

/**
 * Constructs the Algolia hard filters (must-match) based on the extracted intent.
 *
 * @param intent The structured search intent.
 * @returns A string representing the Algolia filter expression, or undefined.
 */
const buildFilters = (intent: XpertIntent): string | undefined => {
  const builder = new AlgoliaFilterBuilder();

  const industries = dedupeStrings(intent.industries || []);
  const jobSources = dedupeStrings(intent.jobSources || []);
  const excludeTags = dedupeStrings(intent.excludeTags || []);

  if (industries.length) {
    builder.or(FACET_FIELDS.INDUSTRY_NAMES, industries, { stringify: true });
  }

  if (jobSources.length) {
    builder.or(FACET_FIELDS.JOB_SOURCES, jobSources, { stringify: true });
  }

  excludeTags.forEach((tag) => {
    builder.andRaw(`NOT ${FACET_FIELDS.SKILLS_DOT_NAME}:${quoteFacetValue(tag)}`);
  });

  const builtFilters = builder.build();

  return isNonEmptyString(builtFilters) ? builtFilters : undefined;
};

/**
 * Builds Algolia `optionalFilters` (soft-boosting) from the intent's required and preferred skills.
 *
 * Required skills are treated as high-weight optional signals; preferred skills (tools, languages)
 * are added at a lower weight and are excluded entirely for beginner learners to avoid over-narrowing.
 * Malformed compound skill strings (e.g. "JavaScript / TypeScript") are skipped and recorded in
 * `droppedSkillInputs` so callers can surface them in debug traces.
 *
 * @param intent The structured search intent produced by the Xpert extraction stage.
 * @returns An object containing the built `optionalFilters` array plus trace arrays
 *   (`requiredSkillFilters`, `preferredSkillFilters`, `droppedSkillInputs`) for audit visibility.
 */
const buildOptionalFiltersWithTrace = (intent: XpertIntent): {
  optionalFilters: string[] | undefined;
  requiredSkillFilters: string[];
  preferredSkillFilters: string[];
  droppedSkillInputs: CareerRetrievalTrace['droppedSkillInputs'];
} => {
  const droppedSkillInputs: CareerRetrievalTrace['droppedSkillInputs'] = [];

  const allRequired = dedupeStrings(intent.skillsRequired || []);
  const allPreferred = dedupeStrings(intent.skillsPreferred || []);

  // Identify and record malformed compounds
  allRequired.forEach((s) => {
    if (isMalformedCompound(s)) { droppedSkillInputs!.push({ skill: s, reason: 'malformed-compound' }); }
  });
  allPreferred.forEach((s) => {
    if (isMalformedCompound(s)) { droppedSkillInputs!.push({ skill: s, reason: 'malformed-compound' }); }
  });

  // Record preferred skills excluded due to beginner level
  if (intent.learnerLevel === 'introductory') {
    allPreferred.filter((s) => !isMalformedCompound(s)).forEach((s) => {
      droppedSkillInputs!.push({ skill: s, reason: 'beginner-level-excluded' });
    });
  }

  const requiredSkillFilters = allRequired
    .filter((s) => !isMalformedCompound(s))
    .slice(0, CAREER_REQUIRED_OPTIONAL_FILTER_LIMIT);

  const preferredSkillFilters = intent.learnerLevel === 'introductory'
    ? []
    : allPreferred
      .filter((s) => !isMalformedCompound(s))
      .slice(0, CAREER_PREFERRED_OPTIONAL_FILTER_LIMIT);

  const optionalFilters = [
    ...requiredSkillFilters.map((skill) => buildOptionalSkillFilter(skill)),
    ...preferredSkillFilters.map((skill) => buildOptionalSkillFilter(skill, 1)),
  ];

  return {
    optionalFilters: optionalFilters.length ? optionalFilters : undefined,
    requiredSkillFilters,
    preferredSkillFilters,
    droppedSkillInputs,
  };
};

/**
 * Derives the primary search query for the taxonomy search.
 * Prioritizes the AI-generated condensedQuery, falling back to roles or required skills.
 *
 * @param intent The structured search intent.
 * @returns The final query string.
 */
const buildCareerQuery = (intent: XpertIntent): string => {
  const condensedQuery = normalizeString(intent.condensedQuery);

  if (condensedQuery) {
    return condensedQuery;
  }

  const fallbackTerms = dedupeStrings([
    ...(intent.roles || []),
    ...(intent.skillsRequired || []),
  ]);

  return fallbackTerms[0] || '';
};

/**
 * Service for deterministic career retrieval from the Algolia taxonomy index.
 *
 * Pipeline context: This is the 'career retrieval' phase. It uses the structured
 * `XpertIntent` to query the taxonomy index for professional roles that align
 * with the user's background and goals.
 *
 * The results are presented to the user as "Career Matches" to choose from.
 */
export const careerRetrievalService = {
  /**
   * Queries the Algolia taxonomy index for professional roles that match the learner's
   * background and goals, then shapes the raw hits into UI-ready `CareerCardModel`s.
   *
   * The query is derived from the intent's `condensedQuery` (AI-generated) or falls back
   * to required roles/skills. Required skills become high-weight `optionalFilters`; preferred
   * skills are added at a lower weight but are suppressed for beginner learners. Hard
   * `filters` scope by industry or job source when provided.
   *
   * After the search, a `CareerRetrievalTrace` is assembled recording the exact query
   * parameters sent, which skills were used or dropped, and per-result summaries with top
   * skills sorted by Lightcast significance — all surfaced in the DebugConsole.
   *
   * @param index The Algolia `SearchIndex` pointing to the taxonomy (career) catalog.
   * @param intent The structured intent produced by the Xpert extraction stage.
   * @returns A promise resolving to `{ careers, trace }` — the career cards and
   *   the full retrieval trace for debugging.
   */
  async searchCareers(
    index: SearchIndex,
    intent: XpertIntent,
  ): Promise<{ careers: CareerCardModel[]; trace: CareerRetrievalTrace }> {
    const query = buildCareerQuery(intent);
    const filters = buildFilters(intent);
    const {
      optionalFilters,
      requiredSkillFilters,
      preferredSkillFilters,
      droppedSkillInputs,
    } = buildOptionalFiltersWithTrace(intent);

    const searchParams: Record<string, unknown> = {
      hitsPerPage: CAREER_RETRIEVAL_LIMIT,
    };

    if (filters) {
      searchParams.filters = filters;
    }

    if (optionalFilters?.length) {
      searchParams.optionalFilters = optionalFilters;
    }

    const response = await index.search<TaxonomyResult>(query, searchParams);
    const { hits } = response;

    const resultSummaries: CareerRetrievalTrace['resultSummaries'] = hits.map((hit) => ({
      id: String(hit.id || hit.objectID || ''),
      title: hit.name || '',
      skillCount: (hit.skills || []).length,
      topSkills: (hit.skills || [])
        .slice()
        .sort((a, b) => (b.significance ?? 0) - (a.significance ?? 0))
        .slice(0, 5)
        .map((s) => ({
          name: s.name,
          significance: s.significance,
          uniquePostings: s.unique_postings,
          typeName: s.type_name,
        })),
      industries: hit.industry_names,
      medianSalary: hit.job_postings?.[0]?.median_salary,
      uniquePostings: hit.job_postings?.[0]?.unique_postings,
    }));

    const trace: CareerRetrievalTrace = {
      query,
      hitsPerPage: CAREER_RETRIEVAL_LIMIT,
      filters,
      optionalFilters: optionalFilters ?? [],
      requiredSkillFilters,
      preferredSkillFilters,
      droppedSkillInputs,
      learnerLevel: intent.learnerLevel,
      resultSummaries,
    };

    return { careers: hits.map(mapTaxonomyResultToCareerCard), trace };
  },
};
