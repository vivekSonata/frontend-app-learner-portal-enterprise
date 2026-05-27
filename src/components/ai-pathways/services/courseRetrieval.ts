import { SearchIndex } from 'algoliasearch/lite';
import { SearchOptions } from '@algolia/client-search';
import { getConfig } from '@edx/frontend-platform';
import {
  CourseCardModel,
  CatalogTranslation,
  RetrievalLadderAttempt,
  RetrievalLadderTrace,
  CourseRetrievalHit,
  CatalogSkillMatch,
  CourseRerankTrace,
} from '../types';

import {
  COURSE_RETRIEVAL_LIMIT,
  MIN_RESULTS_THRESHOLD,
  CONTENT_TYPE_COURSE,
  RETRIEVAL_LADDER_STEPS,
} from '../constants';

/**
 * Formats a single Algolia facet filter expression for a given attribute and value,
 * escaping any embedded double-quotes in the value.
 *
 * @param attr The Algolia facet attribute name (e.g. `'skill_names'`).
 * @param value The facet value to match.
 * @returns A formatted filter string, e.g. `skill_names:"Python"`.
 */
const formatFacet = (attr: string, value: string) => `${attr}:"${value.replace(/"/g, '\\"')}"`;

/**
 * Builds the base Algolia `facetFilters` groups that scope every retrieval ladder step
 * to course-type content within the active enterprise subscription catalog.
 * These filters are applied to all four ladder steps before any skill filters are added.
 *
 * @returns An array of facet filter groups (each group is an OR'd array of strings).
 */
const buildScopedFacetFilters = (): string[][] => {
  const config = getConfig();
  const override = config.ALGOLIA_STAGE_SEARCH_API_KEY_OVERRIDE && config.ALGOLIA_STAGE_APP_ID_OVERRIDE;
  const groups: string[][] = [
    [CONTENT_TYPE_COURSE],
    override && ['enterprise_catalog_query_titles:Subscription'],
    ['metadata_language:en'],
  ].filter(Boolean);
  return groups;
};

/**
 * Builds Algolia search params for Step 1 of the retrieval ladder (Hybrid Broad).
 *
 * Combines the catalog translation query with hard `facetFilters` for each broad-anchor
 * skill and soft `optionalFilters` for each role-differentiator / narrow-signal skill.
 * Returns zero-hit params (`hitsPerPage: 0`) when no skill signals are available,
 * causing this step to be skipped.
 *
 * @param translation The grounded `CatalogTranslation` from the catalog translation stage.
 * @param baseParams The scoped base params (content-type + catalog facet filters).
 * @returns Merged `SearchOptions` with skill filters injected.
 */
const buildHybridBroadParams = (
  translation: CatalogTranslation,
  baseParams: SearchOptions,
): SearchOptions => {
  if (!translation.strictSkillFilters?.length && !translation.boostSkillFilters?.length) {
    return { ...baseParams, hitsPerPage: 0 };
  }

  const baseFacetFilters = (baseParams.facetFilters as string[][] | undefined) || [];
  const skillFilters = translation.strictSkillFilters?.length
    ? translation.strictSkillFilters.map(({ catalogField, catalogSkill }) => formatFacet(catalogField, catalogSkill))
    : undefined;
  const boostFilters = translation.boostSkillFilters?.length
    ? translation.boostSkillFilters.map(({ catalogField, catalogSkill }) => formatFacet(catalogField, catalogSkill))
    : undefined;

  return {
    ...baseParams,
    query: translation.query,
    ...(skillFilters ? { facetFilters: [...baseFacetFilters, skillFilters] } : {}),
    ...(boostFilters ? { optionalFilters: boostFilters } : {}),
  };
};

/**
 * Builds Algolia search params for Step 2 of the retrieval ladder (Boosted Text).
 *
 * Uses the translation query (or first alternate) with only soft `optionalFilters` for
 * boost skills — no hard `facetFilters`. This widens recall relative to Step 1 while
 * still surfacing skill-relevant results at the top of the ranking.
 * Returns zero-hit params when neither a query nor boost signals are available.
 *
 * @param translation The grounded `CatalogTranslation` from the catalog translation stage.
 * @param baseParams The scoped base params.
 * @returns Merged `SearchOptions` with boost-only optional filters.
 */
const buildBoostedTextParams = (
  translation: CatalogTranslation,
  baseParams: SearchOptions,
): SearchOptions => {
  const query = translation.query || translation.queryAlternates[0] || '';
  if (!query && !translation.boostSkillFilters?.length) {
    return { ...baseParams, hitsPerPage: 0 };
  }

  const boostFilters = translation.boostSkillFilters?.length
    ? translation.boostSkillFilters.map(({ catalogField, catalogSkill }) => formatFacet(catalogField, catalogSkill))
    : undefined;

  return {
    ...baseParams,
    query,
    ...(boostFilters ? { optionalFilters: boostFilters } : {}),
  };
};

/**
 * Builds Algolia search params for Steps 3+ of the retrieval ladder (Text Fallback).
 *
 * Uses only the supplied text query with the base scoped filters — no skill facetFilters
 * or optionalFilters. Called for each query alternate (career title, etc.) when earlier
 * steps have not reached the minimum result threshold.
 *
 * @param query The plain-text query string (e.g. career title or alternate phrase).
 * @param baseParams The scoped base params.
 * @returns `SearchOptions` with the text query applied.
 */
const buildQueryFallbackParams = (
  query: string,
  baseParams: SearchOptions,
): SearchOptions => ({ ...baseParams, query });

/**
 * Post-retrieval reranker that scores Algolia course hits by skill overlap and level compatibility.
 *
 * Scoring rules (applied per hit):
 * - Each matched strict skill (`strictSkillFilters`) contributes **10 points**.
 * - Each matched boost skill (`boostSkillFilters`) contributes **3 points**.
 * - A level that exactly matches `learnerLevel` adds **2 points**; one level off adds **1 point**.
 *
 * Hits are sorted descending by score, with original Algolia rank as the tiebreaker.
 * The returned `CourseRerankTrace` records per-course scores, matched skills, and level
 * compatibility — surfaced in the DebugConsole "Retrieval Ladder" section.
 *
 * @param hits Raw Algolia course hits to rerank.
 * @param strictSkillFilters Broad-anchor skill matches used as high-weight signals.
 * @param boostSkillFilters Role-differentiator / narrow-signal matches used as lower-weight signals.
 * @param learnerLevel Optional learner level
 *   (`'beginner' | 'introductory' | 'intermediate' | 'advanced'`) for level bonuses.
 * @returns An object with the reranked `hits` array and a `trace` for debug output.
 */
function rerank(
  hits: any[],
  strictSkillFilters: CatalogSkillMatch[],
  boostSkillFilters: CatalogSkillMatch[],
  learnerLevel?: string,
): { hits: any[]; trace: CourseRerankTrace } {
  if (!strictSkillFilters.length && !boostSkillFilters.length && !learnerLevel) {
    return {
      hits,
      trace: { inputCount: hits.length, outputCount: hits.length, learnerLevel },
    };
  }

  const strictNames = new Set(strictSkillFilters.map((f) => f.catalogSkill.toLowerCase()));
  const boostNames = new Set(boostSkillFilters.map((f) => f.catalogSkill.toLowerCase()));
  const levelOrder: Record<string, number> = {
    beginner: 0,
    introductory: 0,
    intermediate: 1,
    advanced: 2,
  };

  const scored = hits.map((hit, originalIdx) => {
    const hitSkills: string[] = [
      ...(Array.isArray(hit.skill_names) ? hit.skill_names : []),
      ...(Array.isArray(hit['skills.name']) ? hit['skills.name'] : []),
    ].map((s: string) => s.toLowerCase());

    const matchedStrictSkills = hitSkills.filter((s) => strictNames.has(s));
    const matchedBoostSkills = hitSkills.filter((s) => boostNames.has(s));

    const hitLevel = (hit.level || hit.difficulty || hit.level_type || '').toLowerCase();
    let levelBonus = 0;
    type LevelCompatibility = 'matched' | 'near' | 'mismatch' | 'unknown';
    let levelCompatibility: LevelCompatibility = 'unknown';

    if (learnerLevel && hitLevel) {
      const target = levelOrder[learnerLevel] ?? 1;
      let actual: number;
      if (hitLevel.includes('beginner') || hitLevel.includes('introductory')) {
        actual = 0;
      } else if (hitLevel.includes('intermediate')) {
        actual = 1;
      } else {
        actual = 2;
      }
      const diff = Math.abs(actual - target);
      if (diff === 0) { levelBonus = 2; levelCompatibility = 'matched'; } else if (diff === 1) { levelBonus = 1; levelCompatibility = 'near'; } else { levelCompatibility = 'mismatch'; }
    }

    return {
      hit,
      originalIdx,
      score: matchedStrictSkills.length * 10 + matchedBoostSkills.length * 3 + levelBonus,
      matchedStrictSkills,
      matchedBoostSkills,
      levelType: hitLevel,
      levelCompatibility,
    };
  });

  const sortedScored = scored.sort((a, b) => b.score - a.score || a.originalIdx - b.originalIdx);

  const trace: CourseRerankTrace = {
    inputCount: hits.length,
    outputCount: sortedScored.length,
    learnerLevel,
    courseScores: sortedScored.map((item, finalRank) => ({
      objectID: item.hit.objectID || item.hit.id || '',
      title: item.hit.title || item.hit.name,
      originalRank: item.originalIdx,
      finalRank,
      score: item.score,
      matchedStrictSkills: item.matchedStrictSkills,
      matchedBoostSkills: item.matchedBoostSkills,
      levelType: item.levelType,
      levelCompatibility: item.levelCompatibility,
    })),
  };

  return { hits: sortedScored.map(({ hit }) => hit), trace };
}

/**
 * Shapes a raw Algolia course hit into a `CourseCardModel` for display.
 * Field lookups cover multiple Algolia index schema variants (e.g. `title` vs `name`,
 * `image_url` vs `card_image_url`) to stay resilient across catalog configurations.
 *
 * @param hit The raw Algolia course hit object.
 * @param idx Zero-based position in the result set, used to set `order` (1-based).
 * @returns A normalised `CourseCardModel` ready for the pathway assembler.
 */
const mapCourseHitToCard = (hit: any, idx: number): CourseCardModel => ({
  id: hit.id || hit.objectID,
  title: hit.title || hit.name || '',
  level: hit.level_type || hit.difficulty || hit.pacing_type || null,
  skills: Array.isArray(hit.skill_names) ? hit.skill_names : [],
  marketingUrl: hit.marketing_url || hit.url || hit.advertised_course_run_url || null,
  imageUrl: hit.image_url || hit.card_image_url || hit.image?.src || null,
  shortDescription: hit.short_description || hit.description || hit.full_description || null,
  order: idx + 1,
  status: 'recommended',
  raw: hit,
});

/**
 * Service for fetching and ranking courses from the Algolia catalog index.
 *
 * Retrieval Ladder:
 * 1. Hybrid Broad:    query + broad facetFilters + boost optionalFilters
 * 2. Boosted Text:    query + boost optionalFilters, no facetFilters
 * 3. Career Text:     careerTitle query, no skill filters
 * 4. Scope Only:      empty query, base filters only
 */
/**
 * Service for fetching and ranking courses from the Algolia catalog index
 * using a four-step retrieval ladder that progressively relaxes constraints
 * until enough results are found.
 *
 * Retrieval Ladder:
 * 1. **Hybrid Broad**:  query + broad-anchor `facetFilters` + boost `optionalFilters`
 * 2. **Boosted Text**:  query + boost `optionalFilters` only (no hard skill facetFilters)
 * 3. **Career Text**:   plain-text query against the career title and alternates
 * 4. **Scope Only**:    empty query with base catalog/content-type filters (always returns results)
 *
 * Each step that reaches `MIN_RESULTS_THRESHOLD` is declared the winner and the ladder
 * stops. All attempted steps are recorded in `RetrievalLadderTrace` for debug visibility.
 */
export const courseRetrievalService = {
  /**
   * Executes the retrieval ladder against the Algolia catalog index and returns
   * the winning course set alongside a full trace of all ladder attempts.
   *
   * Courses retrieved from the winning step are post-processed by `rerank()` (Steps 1–2)
   * to surface the most skill-relevant and level-appropriate results first.
   *
   * @param translation The grounded `CatalogTranslation` produced by the catalog translation stage,
   *   containing the query, strict facet filters, and boost optional filters.
   * @param index The Algolia `SearchIndex` pointing to the course catalog.
   * @returns A promise resolving to `{ courses, ladderTrace }` — the winning course cards
   *   and the full ladder trace (all attempts, winner step) for debugging.
   */
  async fetchCourses(
    translation: CatalogTranslation,
    index: SearchIndex,
  ): Promise<{ courses: CourseCardModel[]; ladderTrace: RetrievalLadderTrace }> {
    const scopedFacetFilters = buildScopedFacetFilters();

    const baseParams: SearchOptions = {
      hitsPerPage: COURSE_RETRIEVAL_LIMIT,
      facetFilters: scopedFacetFilters,
    };

    const attempts: RetrievalLadderAttempt[] = [];

    const strictSkillsUsed = translation.strictSkillFilters?.map((f) => f.catalogSkill) || [];
    const boostSkillsUsed = translation.boostSkillFilters?.map((f) => f.catalogSkill) || [];
    const { learnerLevel } = translation as any;

    try {
      // Step 1: Hybrid Broad — query + facetFilters (strict) + optionalFilters (boost)
      const hybridParams = buildHybridBroadParams(translation, baseParams);
      if ((hybridParams.hitsPerPage ?? 1) > 0) {
        const hybridResponse = await index.search(translation.query || '', hybridParams);
        const hybridHits = hybridResponse.hits?.length ?? 0;
        const isWinner = hybridHits >= MIN_RESULTS_THRESHOLD;
        const rerankResult = rerank(
          hybridResponse.hits,
          translation.strictSkillFilters || [],
          translation.boostSkillFilters || [],
          learnerLevel,
        );
        attempts.push({
          step: 1,
          label: RETRIEVAL_LADDER_STEPS.STRICT,
          searchMode: 'hybrid-broad',
          query: translation.query || '',
          facetFilters: hybridParams.facetFilters,
          optionalFilters: hybridParams.optionalFilters,
          strictSkillsUsed,
          boostSkillsUsed,
          requestParams: {
            query: translation.query || '',
            facetFilters: hybridParams.facetFilters,
            optionalFilters: hybridParams.optionalFilters,
            hitsPerPage: hybridParams.hitsPerPage,
          },
          hitCount: hybridHits,
          winner: isWinner,
          rerankApplied: true,
          rerankTrace: rerankResult.trace,
          hits: (hybridResponse.hits || []) as unknown as CourseRetrievalHit[],
        });
        if (isWinner) {
          return {
            courses: rerankResult.hits.map(mapCourseHitToCard),
            ladderTrace: { attempts, winnerStep: 1 },
          };
        }
      }

      // Step 2: Boosted Text — query + optionalFilters, no skill facetFilters
      const boostedParams = buildBoostedTextParams(translation, baseParams);
      if ((boostedParams.hitsPerPage ?? 1) > 0) {
        const boostedQuery = translation.query || translation.queryAlternates[0] || '';
        const boostedResponse = await index.search(boostedQuery, boostedParams);
        const boostedHits = boostedResponse.hits?.length ?? 0;
        const isWinner2 = boostedHits >= MIN_RESULTS_THRESHOLD;
        const rerankResult2 = rerank(
          boostedResponse.hits,
          translation.strictSkillFilters || [],
          translation.boostSkillFilters || [],
          learnerLevel,
        );
        attempts.push({
          step: 2,
          label: RETRIEVAL_LADDER_STEPS.BOOST,
          searchMode: 'boosted-text',
          query: boostedQuery,
          facetFilters: boostedParams.facetFilters,
          optionalFilters: boostedParams.optionalFilters,
          boostSkillsUsed,
          requestParams: {
            query: boostedQuery,
            facetFilters: boostedParams.facetFilters,
            optionalFilters: boostedParams.optionalFilters,
            hitsPerPage: boostedParams.hitsPerPage,
          },
          hitCount: boostedHits,
          winner: isWinner2,
          rerankApplied: true,
          rerankTrace: rerankResult2.trace,
          hits: (boostedResponse.hits || []) as unknown as CourseRetrievalHit[],
        });
        if (isWinner2) {
          return {
            courses: rerankResult2.hits.map(mapCourseHitToCard),
            ladderTrace: { attempts, winnerStep: 2 },
          };
        }
      }

      // Step 3: Text Fallback — careerTitle and/or translation.query
      const queries = [translation.query, ...translation.queryAlternates].filter(Boolean);
      for (const q of queries) {
        const queryParams = buildQueryFallbackParams(q, baseParams);
        // eslint-disable-next-line no-await-in-loop
        const queryResponse = await index.search(q, queryParams);
        const queryHits = queryResponse.hits?.length ?? 0;
        const isWinner3 = queryHits >= MIN_RESULTS_THRESHOLD;
        attempts.push({
          step: 3,
          label: `${RETRIEVAL_LADDER_STEPS.QUERY_ALTERNATE}: ${q}`,
          searchMode: 'career-text',
          query: q,
          facetFilters: queryParams.facetFilters,
          requestParams: { query: q, facetFilters: queryParams.facetFilters, hitsPerPage: queryParams.hitsPerPage },
          hitCount: queryHits,
          winner: isWinner3,
          hits: (queryResponse.hits || []) as unknown as CourseRetrievalHit[],
        });
        if (isWinner3) {
          return {
            courses: queryResponse.hits.map(mapCourseHitToCard),
            ladderTrace: { attempts, winnerStep: 3 },
          };
        }
      }

      // Step 4: Scope Only Fallback — empty query, base filters only
      const fallbackResponse = await index.search('', baseParams);
      const fallbackHits = fallbackResponse.hits?.length ?? 0;
      attempts.push({
        step: 4,
        label: RETRIEVAL_LADDER_STEPS.FALLBACK,
        searchMode: 'scope-only',
        query: '',
        facetFilters: baseParams.facetFilters,
        requestParams: { query: '', facetFilters: baseParams.facetFilters, hitsPerPage: baseParams.hitsPerPage },
        hitCount: fallbackHits,
        winner: true,
        hits: (fallbackResponse.hits || []) as unknown as CourseRetrievalHit[],
      });
      return {
        courses: (fallbackResponse.hits || []).map(mapCourseHitToCard),
        ladderTrace: { attempts, winnerStep: 4 },
      };
    } catch (error) {
      attempts.push({
        step: 1, label: 'Error', searchMode: 'error', hitCount: 0, winner: false,
      });
      return { courses: [], ladderTrace: { attempts, winnerStep: null } };
    }
  },
};
