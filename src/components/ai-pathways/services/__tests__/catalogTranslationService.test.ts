import { catalogTranslationService } from '../catalogTranslationService';
import { RulesFirstCandidates } from '../../types';

describe('catalogTranslationService', () => {
  /** Legacy no-tier data: simulates pre-tiering or missing skillDetails. */
  const mockRulesFirstWithMatches: RulesFirstCandidates = {
    exactMatches: ['Python', 'SQL'],
    aliasMatches: ['Data Analysis'],
    exactSkillFilters: [
      {
        taxonomySkill: 'Python', catalogSkill: 'Python', catalogField: 'skill_names', matchMethod: 'exact',
      },
      {
        taxonomySkill: 'SQL', catalogSkill: 'SQL', catalogField: 'skill_names', matchMethod: 'exact',
      },
    ],
    aliasSkillFilters: [
      {
        taxonomySkill: 'Data Analysis', catalogSkill: 'Data Analysis', catalogField: 'skill_names', matchMethod: 'alias',
      },
    ],
    unmatched: ['UnknownSkill'],
  };

  const mockRulesFirstNoMatches: RulesFirstCandidates = {
    exactMatches: [],
    aliasMatches: [],
    exactSkillFilters: [],
    aliasSkillFilters: [],
    unmatched: ['ObscureTechA', 'ObscureTechB'],
  };

  /** Tiered data: broad anchors + narrow boosters. */
  const tieredRulesFirst: RulesFirstCandidates = {
    exactMatches: ['Cloud Computing', 'DevOps', 'Python', 'JSON'],
    aliasMatches: [],
    exactSkillFilters: [
      {
        taxonomySkill: 'Cloud Computing',
        catalogSkill: 'Cloud Computing',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'broad_anchor',
        score: 80,
        source: 'intent_required',
      },
      {
        taxonomySkill: 'DevOps',
        catalogSkill: 'DevOps',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'broad_anchor',
        score: 80,
        source: 'intent_required',
      },
      {
        taxonomySkill: 'Python',
        catalogSkill: 'Python',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'narrow_signal',
        score: 40,
        source: 'intent_preferred',
      },
      {
        taxonomySkill: 'JSON',
        catalogSkill: 'JSON',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'narrow_signal',
        score: 35,
        source: 'career_taxonomy',
      },
    ],
    aliasSkillFilters: [],
    unmatched: [],
  };

  describe('processTranslation — legacy (no-tier) facet-first mode', () => {
    it('populates strictSkillFilters from both exact and alias matches', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(translation.strictSkillFilters).toHaveLength(3);
      expect(translation.strictSkillFilters.map((f) => f.catalogSkill)).toContain('Python');
      expect(translation.strictSkillFilters.map((f) => f.catalogSkill)).toContain('SQL');
      expect(translation.strictSkillFilters.map((f) => f.catalogSkill)).toContain('Data Analysis');
    });

    it('sets boostSkillFilters to empty for legacy no-tier data', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(translation.boostSkillFilters).toHaveLength(0);
    });

    it('builds a query from skill names (not empty string) for legacy data', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      // Query is built from skill names (lowercased) since no intentRequiredSkills
      expect(translation.query).toBeTruthy();
      expect(translation.query).not.toBe('Data Scientist');
    });

    it('sets queryAlternates to [careerTitle] when skills are mapped', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(translation.queryAlternates).toEqual(['Data Scientist']);
    });

    it('puts unmatched skills in droppedTaxonomySkills', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(translation.droppedTaxonomySkills).toContain('UnknownSkill');
    });

    it('builds skillProvenance with correct matchMethod entries', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(translation.skillProvenance).toContainEqual({
        taxonomySkill: 'Python',
        catalogMatch: 'Python',
        catalogField: 'skill_names',
        matchMethod: 'exact',
      });
      expect(translation.skillProvenance).toContainEqual({
        taxonomySkill: 'UnknownSkill',
        matchMethod: 'none',
      });
    });

    it('sets courseSearchMode to facet-first in trace', () => {
      const { trace } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(trace.courseSearchMode).toBe('facet-first');
    });

    it('reports correct facetMatchCount and facetMatchRate', () => {
      const { trace } = catalogTranslationService.processTranslation(
        'Data Scientist',
        mockRulesFirstWithMatches,
      );
      expect(trace.facetMatchCount).toBe(3);
      // 3 matched of 4 total (3 matched + 1 unmatched)
      expect(trace.facetMatchRate).toBeCloseTo(0.75);
    });
  });

  describe('processTranslation — text-fallback mode', () => {
    it('sets query to careerTitle when no skills are mapped', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Quantum Engineer',
        mockRulesFirstNoMatches,
      );
      expect(translation.query).toBe('Quantum Engineer');
    });

    it('sets queryAlternates to [] when no skills are mapped', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Quantum Engineer',
        mockRulesFirstNoMatches,
      );
      expect(translation.queryAlternates).toEqual([]);
    });

    it('sets courseSearchMode to text-fallback in trace', () => {
      const { trace } = catalogTranslationService.processTranslation(
        'Quantum Engineer',
        mockRulesFirstNoMatches,
      );
      expect(trace.courseSearchMode).toBe('text-fallback');
    });

    it('reports facetMatchCount of 0 and facetMatchRate of 0 when nothing matches', () => {
      const { trace } = catalogTranslationService.processTranslation(
        'Quantum Engineer',
        mockRulesFirstNoMatches,
      );
      expect(trace.facetMatchCount).toBe(0);
      expect(trace.facetMatchRate).toBe(0);
    });
  });

  describe('processTranslation — tiered hybrid-broad mode', () => {
    it('puts broad_anchor skills into strictSkillFilters', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Full Stack Engineer',
        tieredRulesFirst,
      );
      const strictNames = translation.strictSkillFilters.map((f) => f.catalogSkill);
      expect(strictNames).toContain('Cloud Computing');
      expect(strictNames).toContain('DevOps');
    });

    it('puts narrow_signal skills into boostSkillFilters', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Full Stack Engineer',
        tieredRulesFirst,
      );
      const boostNames = translation.boostSkillFilters.map((f) => f.catalogSkill);
      expect(boostNames).toContain('Python');
      expect(boostNames).toContain('JSON');
    });

    it('sets courseSearchMode to hybrid-broad when both strict and boost are non-empty', () => {
      const { trace } = catalogTranslationService.processTranslation(
        'Full Stack Engineer',
        tieredRulesFirst,
      );
      expect(trace.courseSearchMode).toBe('hybrid-broad');
    });

    it('uses intentRequiredSkills for query when provided', () => {
      const { translation } = catalogTranslationService.processTranslation(
        'Full Stack Engineer',
        tieredRulesFirst,
        { intentRequiredSkills: ['Software Development', 'Cloud Computing', 'DevOps'] },
      );
      expect(translation.query).toBe('software development cloud computing devops');
    });

    it('caps strictSkillFilters at BEGINNER_MAX_STRICT_SKILLS (3) for beginners', () => {
      const manyBroadAnchors: RulesFirstCandidates = {
        exactMatches: [],
        aliasMatches: [],
        exactSkillFilters: Array(6).fill(0).map((_, i) => ({
          taxonomySkill: `Broad ${i}`,
          catalogSkill: `Broad ${i}`,
          catalogField: 'skill_names' as const,
          matchMethod: 'exact' as const,
          tier: 'broad_anchor' as const,
          score: 80,
        })),
        aliasSkillFilters: [],
        unmatched: [],
      };
      const { translation } = catalogTranslationService.processTranslation(
        'Engineer',
        manyBroadAnchors,
        { learnerLevel: 'introductory' },
      );
      expect(translation.strictSkillFilters.length).toBeLessThanOrEqual(3);
    });

    it('caps strictSkillFilters at MAX_STRICT_SKILLS (4) for non-beginner', () => {
      const manyBroadAnchors: RulesFirstCandidates = {
        exactMatches: [],
        aliasMatches: [],
        exactSkillFilters: Array(8).fill(0).map((_, i) => ({
          taxonomySkill: `Broad ${i}`,
          catalogSkill: `Broad ${i}`,
          catalogField: 'skill_names' as const,
          matchMethod: 'exact' as const,
          tier: 'broad_anchor' as const,
          score: 80,
        })),
        aliasSkillFilters: [],
        unmatched: [],
      };
      const { translation } = catalogTranslationService.processTranslation(
        'Engineer',
        manyBroadAnchors,
        { learnerLevel: 'intermediate' },
      );
      expect(translation.strictSkillFilters.length).toBeLessThanOrEqual(4);
    });
  });

  describe('processTranslation — legacy skill capping', () => {
    it('caps strictSkillFilters at MAX_STRICT_SKILLS (4) for legacy no-tier data', () => {
      const manyFilters = Array(12).fill(0).map((_, i) => ({
        taxonomySkill: `Skill ${i}`,
        catalogSkill: `Skill ${i}`,
        catalogField: 'skill_names' as const,
        matchMethod: 'exact' as const,
      }));
      const heavyRulesFirst: RulesFirstCandidates = {
        exactMatches: manyFilters.map((f) => f.catalogSkill),
        aliasMatches: [],
        exactSkillFilters: manyFilters,
        aliasSkillFilters: [],
        unmatched: [],
      };

      const { translation } = catalogTranslationService.processTranslation('Engineer', heavyRulesFirst);
      expect(translation.strictSkillFilters.length).toBeLessThanOrEqual(4);
    });
  });
});
