import {
  RulesFirstCandidates,
  CatalogTranslation,
  CatalogSearchIntent,
  SkillProvenance,
  CatalogTranslationTrace,
  LearnerLevel,
  CatalogSkillMatch,
} from '../types';
import type { RetrievalSkillTier } from '../types/translationContracts';
import {
  MAX_STRICT_SKILLS,
  MAX_BOOST_SKILLS,
  BEGINNER_MAX_STRICT_SKILLS,
} from '../constants';

/**
 * Service for consolidating deterministic taxonomy-to-catalog mapping results.
 *
 * Pipeline context: This is the 'catalogTranslation' stage. It takes the output
 * of the rules-first deterministic mapping and produces a CatalogTranslation
 * ready for the hybrid retrieval ladder.
 *
 * With tiering:
 *   strictSkillFilters = broad_anchor skills → hard facetFilters
 *   boostSkillFilters  = role_differentiator + narrow_signal → optionalFilters
 *   query              = broadTerms from intentRequiredSkills (or broad anchors)
 *
 * Without tiering (legacy / no tier metadata):
 *   falls back to original behavior (all matches → strictSkillFilters)
 */
export const catalogTranslationService = {
  /**
   * Converts rules-first mapping candidates into a fully grounded `CatalogTranslation`
   * ready for the course retrieval ladder.
   *
   * The translation strategy depends on what tiering metadata is available:
   * - **Hybrid-broad** (primary): broad_anchor skills → `strictSkillFilters` (facetFilters);
   *   role_differentiator + narrow_signal → `boostSkillFilters` (optionalFilters).
   * - **Strict-only** (legacy): no tier metadata present — all matches go to `strictSkillFilters`.
   * - **Promote** (fallback): only role_differentiators/narrow_signals available — up to 2
   *   are promoted to strict to guarantee some facet-based recall.
   *
   * The query is derived from `intentRequiredSkills` when available, otherwise from the
   * broad anchor catalog names, falling back to the career title.
   *
   * @param careerTitle The selected career title; used as a text-fallback query.
   * @param rulesFirst The output of `catalogTranslationRules.translateTaxonomyToCatalog`.
   * @param options Optional learner level (controls strict skill caps) and intent required skills
   *   (used to build the primary query string).
   * @returns A CatalogTranslation for retrieval and a CatalogTranslationTrace for debugging.
   */
  processTranslation(
    careerTitle: string,
    rulesFirst: RulesFirstCandidates,
    options: { learnerLevel?: LearnerLevel; intentRequiredSkills?: string[] } = {},
  ): { translation: CatalogTranslation; trace: CatalogTranslationTrace } {
    const allMatches: CatalogSkillMatch[] = [
      ...rulesFirst.exactSkillFilters,
      ...rulesFirst.aliasSkillFilters,
    ];

    const broadAnchors = allMatches
      .filter((m) => m.tier === 'broad_anchor')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const boosters = allMatches
      .filter((m) => m.tier === 'role_differentiator' || m.tier === 'narrow_signal')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Legacy path: no tier info attached (e.g., old test data or missing skillDetails)
    const noTierMatches = allMatches.filter((m) => !m.tier);

    const maxStrict = options.learnerLevel === 'introductory' ? BEGINNER_MAX_STRICT_SKILLS : MAX_STRICT_SKILLS;

    let strictSkillFilters: CatalogSkillMatch[];
    let boostSkillFilters: CatalogSkillMatch[];

    if (broadAnchors.length > 0) {
      strictSkillFilters = broadAnchors.slice(0, maxStrict);
      boostSkillFilters = boosters.slice(0, MAX_BOOST_SKILLS);
    } else if (noTierMatches.length > 0) {
      // Legacy: preserve old behavior when no tiering info is present
      strictSkillFilters = noTierMatches.slice(0, maxStrict);
      boostSkillFilters = [];
    } else {
      // Only role_differentiators/narrow_signals available — allow up to 2 into strict
      const roleStrict = options.learnerLevel === 'introductory'
        ? boosters.filter((m) => m.tier === 'role_differentiator').slice(0, 2)
        : boosters.slice(0, 2);
      strictSkillFilters = roleStrict;
      boostSkillFilters = boosters.slice(roleStrict.length, roleStrict.length + MAX_BOOST_SKILLS);
    }

    // Build query from broad required skills or career title
    const broadTerms = options.intentRequiredSkills?.length
      ? options.intentRequiredSkills.slice(0, 3).map((s) => s.toLowerCase()).join(' ')
      : strictSkillFilters.slice(0, 3).map((f) => f.catalogSkill.toLowerCase()).join(' ');
    const query = broadTerms || careerTitle;
    const queryAlternates = query !== careerTitle ? [careerTitle] : [];

    const hasMappedFacets = strictSkillFilters.length > 0 || boostSkillFilters.length > 0;

    let courseSearchMode: CatalogTranslationTrace['courseSearchMode'];
    if (strictSkillFilters.length > 0 && boostSkillFilters.length > 0) {
      courseSearchMode = 'hybrid-broad';
    } else if (strictSkillFilters.length > 0 && boostSkillFilters.length === 0) {
      courseSearchMode = 'facet-first';
    } else if (strictSkillFilters.length === 0 && boostSkillFilters.length > 0) {
      courseSearchMode = 'text-boost';
    } else {
      courseSearchMode = 'text-fallback';
    }

    const finalIntent: CatalogSearchIntent = {
      query: hasMappedFacets ? query : careerTitle,
      queryAlternates: hasMappedFacets ? queryAlternates : [],
      strictSkillFilters,
      boostSkillFilters,
      droppedTaxonomySkills: [...rulesFirst.unmatched],
    };

    const skillProvenance = this.buildSkillProvenance(rulesFirst);

    const totalInputSkills = rulesFirst.exactSkillFilters.length
      + rulesFirst.aliasSkillFilters.length
      + rulesFirst.unmatched.length;

    let strictSelectionReason: string;
    if (broadAnchors.length > 0) {
      strictSelectionReason = 'Broad anchor skills selected for stable catalog recall.';
    } else if (noTierMatches.length > 0) {
      strictSelectionReason = 'Legacy path: all matches used as strict filters (no tier metadata).';
    } else {
      strictSelectionReason = 'Role differentiators promoted to strict (no broad anchors available).';
    }

    const boostSelectionReason = boostSkillFilters.length > 0
      ? 'Role differentiators and narrow signals retained as optional boosts.'
      : 'No boost signals available.';

    const tierCounts = allMatches.reduce((acc, m) => {
      if (m.tier) {
        acc[m.tier] = (acc[m.tier] ?? 0) + 1;
      }
      return acc;
    }, {} as Partial<Record<RetrievalSkillTier, number>>);

    let querySource: CatalogTranslationTrace['querySource'];
    if (options.intentRequiredSkills?.length) {
      querySource = 'intent_required';
    } else if (strictSkillFilters.length > 0) {
      querySource = 'strict_filters';
    } else {
      querySource = 'career_title';
    }

    const trace: CatalogTranslationTrace = {
      query: finalIntent.query,
      queryAlternates: finalIntent.queryAlternates,
      strictSkillCount: strictSkillFilters.length,
      boostSkillCount: boostSkillFilters.length,
      droppedSkillCount: finalIntent.droppedTaxonomySkills.length,
      strictSkills: strictSkillFilters.map((f) => f.catalogSkill),
      boostSkills: boostSkillFilters.map((f) => f.catalogSkill),
      strictSkillFilters,
      boostSkillFilters,
      courseSearchMode,
      facetMatchCount: allMatches.length,
      facetMatchRate: totalInputSkills > 0
        ? Math.round((allMatches.length / totalInputSkills) * 100) / 100
        : 0,
      strictSelectionReason,
      boostSelectionReason,
      droppedTaxonomySkills: [...rulesFirst.unmatched],
      tierCounts,
      querySource,
      learnerLevel: options.learnerLevel,
    };

    const translation: CatalogTranslation = {
      ...finalIntent,
      skillProvenance,
      learnerLevel: options.learnerLevel,
    };

    return { translation, trace };
  },

  /**
   * Builds a flat per-skill audit trail from all three outcome buckets of a rules-first
   * mapping run: exact matches, alias matches, and unmatched skills.
   *
   * Each entry records how a taxonomy skill was resolved to a catalog term (or not),
   * preserving both the source name and the Algolia field it was found in. This provenance
   * array is attached to the `CatalogTranslation` and surfaced in the DebugConsole
   * "Rules-First Mapping" section so every skill's fate is visible without parsing raw data.
   *
   * @param rulesFirst The output of `catalogTranslationRules.translateTaxonomyToCatalog`,
   *   containing `exactSkillFilters`, `aliasSkillFilters`, and `unmatched` arrays.
   * @returns An array of `SkillProvenance` entries — one per input skill — covering
   *   all exact, alias, and unmatched outcomes.
   */
  buildSkillProvenance(rulesFirst: RulesFirstCandidates): SkillProvenance[] {
    const provenance: SkillProvenance[] = [];

    rulesFirst.exactSkillFilters.forEach((match) => {
      provenance.push({
        taxonomySkill: match.taxonomySkill,
        catalogMatch: match.catalogSkill,
        catalogField: match.catalogField,
        matchMethod: 'exact',
      });
    });

    rulesFirst.aliasSkillFilters.forEach((match) => {
      provenance.push({
        taxonomySkill: match.taxonomySkill,
        catalogMatch: match.catalogSkill,
        catalogField: match.catalogField,
        matchMethod: 'alias',
      });
    });

    rulesFirst.unmatched.forEach((skill) => {
      provenance.push({
        taxonomySkill: skill,
        matchMethod: 'none',
      });
    });

    return provenance;
  },
};
