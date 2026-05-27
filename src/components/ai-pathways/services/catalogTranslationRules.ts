import { RulesFirstCandidates, TaxonomyTranslationInput } from '../types/catalogTranslation';
import {
  CatalogSkillMatch, RulesFirstMappingTrace, SkillSignal, TieredSkillTrace,
} from '../types';
import { CATALOG_ALIAS_MAP } from '../constants';
import { tierAllSignals } from './skillTiering';

/**
 * Normalises a term for catalog alias matching and comparison.
 * Trims whitespace and converts to lowercase so that lookups against the
 * facet snapshot and the `CATALOG_ALIAS_MAP` are always case-insensitive.
 *
 * @param term The raw skill or subject term to normalise.
 * @returns The trimmed, lowercased version of the term.
 */
export const normalizeCatalogTerm = (term: string): string => term.trim().toLowerCase();

/**
 * Deterministic mapper that translates taxonomy terms into catalog-valid search parameters.
 *
 * Pipeline context: This is the first sub-stage of the 'catalogTranslation' phase.
 * It uses high-confidence rules (exact matches and a curated alias map) to ground
 * taxonomy data into the specific course catalog.
 */
export const catalogTranslationRules = {
  /**
   * Translates a list of taxonomy skill signals into validated Algolia facet parameters
   * using deterministic rules — no AI calls at this stage.
   *
   * The process:
   * 1. Builds a normalised lookup map from the `CatalogFacetSnapshot` (all known skill values).
   * 2. Passes the skills through `skillTiering.tierAllSignals` to assign each signal a
   *    `RetrievalSkillTier` (`broad_anchor`, `role_differentiator`, `narrow_signal`, `noise`).
   * 3. Checks each tiered signal against the facet snapshot via exact case-insensitive match,
   *    then falls back to the `CATALOG_ALIAS_MAP` for curated synonyms.
   * 4. Splits matched signals into `exactSkillFilters` and `aliasSkillFilters`; unresolved
   *    signals go into `unmatched`.
   *
   * The returned `RulesFirstMappingTrace` records every tiered signal's outcome (`decision`,
   * `catalogSkill`, `matchMethod`, significance, etc.) and is consumed by the DebugConsole.
   *
   * @param input Contains the `skills` array (from intent + career taxonomy) and the
   *   `facetSnapshot` capturing valid catalog values for the learner's specific catalog.
   * @returns An object with `result` (the grounded facet candidates) and `trace` (full
   *   audit trail for every skill signal processed).
   */
  translateTaxonomyToCatalog(
    input: TaxonomyTranslationInput,
  ): { result: RulesFirstCandidates; trace: RulesFirstMappingTrace } {
    const { skills, facetSnapshot } = input;

    // Build a normalized lookup map (normalizedValue -> originalCatalogValue).
    const validCatalogValues = new Set<string>();
    const normalizedLookup = new Map<
    string,
    { value: string; field: 'skill_names' | 'skills.name' | 'subjects' }
    >();

    facetSnapshot.skill_names.forEach((value) => {
      validCatalogValues.add(value);
      normalizedLookup.set(normalizeCatalogTerm(value), { value, field: 'skill_names' });
    });

    facetSnapshot['skills.name'].forEach((value) => {
      validCatalogValues.add(value);
      if (!normalizedLookup.has(normalizeCatalogTerm(value))) {
        normalizedLookup.set(normalizeCatalogTerm(value), { value, field: 'skills.name' });
      }
    });

    facetSnapshot.subjects.forEach((value) => {
      validCatalogValues.add(value);
      normalizedLookup.set(normalizeCatalogTerm(value), { value, field: 'subjects' });
    });

    // Build SkillSignal list from all input sources for tiering
    const signals: SkillSignal[] = [
      ...(input.intentRequiredSkills || []).map((name) => ({
        name, source: 'intent_required' as const,
      })),
      ...(input.intentPreferredSkills || []).map((name) => ({
        name, source: 'intent_preferred' as const,
      })),
      ...(input.skillDetails?.length
        ? input.skillDetails.map((s) => ({
          name: s.name,
          source: 'career_taxonomy' as const,
          significance: s.significance,
          uniquePostings: s.unique_postings,
          typeName: s.type_name,
        }))
        : skills.map((name) => ({ name, source: 'career_taxonomy' as const }))
      ),
    ];

    const tieredSignals = tierAllSignals(signals);

    // Build a map from normalized name → tiered signal for lookup during matching
    const tieredMap = new Map(tieredSignals.map((s) => [s.normalizedName, s]));

    // Build terms to translate from ALL non-noise signals plus the raw skills list
    const allTermNames = new Set([
      ...tieredSignals.filter((s) => s.tier !== 'noise').map((s) => s.name),
      ...skills.map((s) => s.trim()).filter(Boolean),
    ]);
    const termsToTranslate = Array.from(allTermNames);

    const exactMatchesSet = new Set<string>();
    const aliasMatchesSet = new Set<string>();
    const unmatchedSet = new Set<string>();
    const exactSkillFilters: CatalogSkillMatch[] = [];
    const aliasSkillFilters: CatalogSkillMatch[] = [];

    termsToTranslate.forEach((term) => {
      const normTerm = normalizeCatalogTerm(term);
      const tierInfo = tieredMap.get(normTerm);

      // 1. Check Exact Match (Case-insensitive)
      if (normalizedLookup.has(normTerm)) {
        const match = normalizedLookup.get(normTerm)!;
        exactMatchesSet.add(match.value);

        if (match.field === 'skill_names' || match.field === 'skills.name') {
          exactSkillFilters.push({
            taxonomySkill: term,
            catalogSkill: match.value,
            catalogField: match.field,
            matchMethod: 'exact',
            tier: tierInfo?.tier,
            score: tierInfo?.score,
            source: tierInfo?.source,
            significance: tierInfo?.significance,
            reasons: tierInfo?.reasons,
          });
        }
        return;
      }

      // 2. Check Curated Alias Map
      const aliasTarget = CATALOG_ALIAS_MAP[normTerm];
      if (aliasTarget) {
        const aliasMatch = normalizedLookup.get(normalizeCatalogTerm(aliasTarget));
        if (aliasMatch && (aliasMatch.field === 'skill_names' || aliasMatch.field === 'skills.name')) {
          aliasMatchesSet.add(aliasMatch.value);
          aliasSkillFilters.push({
            taxonomySkill: term,
            catalogSkill: aliasMatch.value,
            catalogField: aliasMatch.field,
            matchMethod: 'alias',
            tier: tierInfo?.tier,
            score: tierInfo?.score,
            source: tierInfo?.source,
            significance: tierInfo?.significance,
            reasons: tierInfo?.reasons,
          });
          return;
        }
      }

      // 3. Mark as unmatched for later stages
      unmatchedSet.add(term);
    });

    const result: RulesFirstCandidates = {
      exactMatches: Array.from(exactMatchesSet).sort(),
      aliasMatches: Array.from(aliasMatchesSet).sort(),
      unmatched: Array.from(unmatchedSet).sort(),
      exactSkillFilters,
      aliasSkillFilters,
    };

    const noiseDropped = tieredSignals
      .filter((s) => s.tier === 'noise')
      .map((s) => s.name);

    const allMatchedFilters = [...exactSkillFilters, ...aliasSkillFilters];
    const matchedByNormalizedName = new Map(
      allMatchedFilters.map((f) => [normalizeCatalogTerm(f.taxonomySkill), f]),
    );

    const broadAnchorCatalogSkills = allMatchedFilters
      .filter((f) => f.tier === 'broad_anchor')
      .map((f) => f.catalogSkill);

    const boostCatalogSkills = allMatchedFilters
      .filter((f) => f.tier === 'role_differentiator' || f.tier === 'narrow_signal')
      .map((f) => f.catalogSkill);

    const roleDifferentiatorMatches = tieredSignals
      .filter((s) => s.tier === 'role_differentiator')
      .map((s) => s.name);

    const narrowSignalMatches = tieredSignals
      .filter((s) => s.tier === 'narrow_signal')
      .map((s) => s.name);

    const tieringTrace: TieredSkillTrace[] = tieredSignals.map((s) => {
      const match = matchedByNormalizedName.get(s.normalizedName);

      let decision: TieredSkillTrace['decision'];
      if (s.tier === 'noise') {
        decision = 'dropped';
      } else if (!match) {
        decision = 'unmatched';
      } else if (s.tier === 'broad_anchor') {
        decision = 'strict';
      } else {
        decision = 'boost';
      }

      return {
        name: s.name,
        normalizedName: s.normalizedName,
        source: s.source,
        tier: s.tier,
        score: s.score,
        significance: s.significance,
        uniquePostings: s.uniquePostings,
        typeName: s.typeName,
        reasons: s.reasons,
        catalogSkill: match?.catalogSkill,
        catalogField: match?.catalogField,
        matchMethod: match?.matchMethod,
        decision,
      };
    });

    const trace: RulesFirstMappingTrace = {
      termsConsidered: termsToTranslate.length,
      exactMatchCount: result.exactMatches.length,
      aliasMatchCount: result.aliasMatches.length,
      unmatchedCount: result.unmatched.length,
      exactMatches: result.exactMatches,
      aliasMatches: result.aliasMatches,
      unmatched: result.unmatched,
      broadAnchorMatches: broadAnchorCatalogSkills,
      boostMatches: boostCatalogSkills,
      roleDifferentiatorMatches,
      narrowSignalMatches,
      strictCandidateCount: tieredSignals.filter((s) => s.tier === 'broad_anchor').length,
      boostCandidateCount: tieredSignals.filter((s) => s.tier === 'role_differentiator' || s.tier === 'narrow_signal').length,
      noiseDropped,
      tieringTrace,
    };

    return { result, trace };
  },
};
