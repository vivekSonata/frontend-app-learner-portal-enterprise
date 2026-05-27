import { courseRetrievalService } from '../courseRetrieval';
import { CatalogTranslation } from '../../types';

const mockSearch = jest.fn();
const mockIndex = { search: mockSearch } as any;

describe('courseRetrievalService', () => {
  /** Hybrid-broad mode: broad anchors in strict, narrow signals in boost. */
  const hybridBroadTranslation: CatalogTranslation = {
    query: 'cloud computing devops',
    queryAlternates: ['Full Stack Engineer'],
    strictSkillFilters: [
      {
        taxonomySkill: 'Cloud Computing',
        catalogSkill: 'Cloud Computing',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'broad_anchor',
      },
      {
        taxonomySkill: 'DevOps',
        catalogSkill: 'DevOps',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'broad_anchor',
      },
    ],
    boostSkillFilters: [
      {
        taxonomySkill: 'Python',
        catalogSkill: 'Python',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'narrow_signal',
      },
      {
        taxonomySkill: 'JSON',
        catalogSkill: 'JSON',
        catalogField: 'skill_names',
        matchMethod: 'exact',
        tier: 'narrow_signal',
      },
    ],
    droppedTaxonomySkills: [],
    skillProvenance: [],
  };

  /** Legacy facet-first mode: matched skills, no boost tier info. */
  const facetFirstTranslation: CatalogTranslation = {
    query: 'python sql',
    queryAlternates: ['Software Engineer'],
    strictSkillFilters: [
      {
        taxonomySkill: 'Python', catalogSkill: 'Python', catalogField: 'skill_names', matchMethod: 'exact',
      },
      {
        taxonomySkill: 'SQL', catalogSkill: 'SQL', catalogField: 'skill_names', matchMethod: 'exact',
      },
    ],
    boostSkillFilters: [],
    droppedTaxonomySkills: [],
    skillProvenance: [],
  };

  /** Text-fallback mode: no skills mapped, query is the career title. */
  const textFallbackTranslation: CatalogTranslation = {
    query: 'Quantum Engineer',
    queryAlternates: [],
    strictSkillFilters: [],
    boostSkillFilters: [],
    droppedTaxonomySkills: ['ObscureTechA'],
    skillProvenance: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('step 1: hybrid broad (facets + boosts)', () => {
    it('passes broad-anchor skills as facetFilters and boost skills as optionalFilters', async () => {
      mockSearch.mockResolvedValueOnce({
        hits: Array(3).fill({ objectID: 'c', title: 'Course' }),
      });

      await courseRetrievalService.fetchCourses(hybridBroadTranslation, mockIndex);

      expect(mockSearch).toHaveBeenCalledTimes(1);
      const [queryArg, paramsArg] = mockSearch.mock.calls[0];

      // Non-empty query is used
      expect(queryArg).toBe('cloud computing devops');

      // Broad anchors appear in facetFilters (as OR group)
      expect(paramsArg.facetFilters).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            'skill_names:"Cloud Computing"',
            'skill_names:"DevOps"',
          ]),
        ]),
      );

      // Narrow boost skills appear in optionalFilters
      expect(paramsArg.optionalFilters).toEqual(
        expect.arrayContaining([
          'skill_names:"Python"',
          'skill_names:"JSON"',
        ]),
      );
    });

    it('narrow skill (JSON) appears in optionalFilters, NOT in facetFilters skill group', async () => {
      mockSearch.mockResolvedValueOnce({
        hits: Array(3).fill({ objectID: 'c', title: 'Course' }),
      });

      await courseRetrievalService.fetchCourses(hybridBroadTranslation, mockIndex);

      const [, paramsArg] = mockSearch.mock.calls[0];

      // Flatten all strings inside facetFilters to check JSON is absent
      const facetFilterStrings = (paramsArg.facetFilters as string[][])
        .flat()
        .join(' ');
      expect(facetFilterStrings).not.toContain('"JSON"');

      // JSON must appear in optionalFilters
      expect((paramsArg.optionalFilters as string[]).some((f: string) => f.includes('"JSON"'))).toBe(true);
    });

    it('returns step-1 results when hit count meets MIN_RESULTS_THRESHOLD (3)', async () => {
      mockSearch.mockResolvedValueOnce({ hits: Array(3).fill({ objectID: 'c', title: 'Course' }) });
      const { ladderTrace } = await courseRetrievalService.fetchCourses(hybridBroadTranslation, mockIndex);
      expect(ladderTrace.winnerStep).toBe(1);
    });

    it('step-1 attempt has searchMode=hybrid-broad, rerankApplied=true, and rerankTrace', async () => {
      mockSearch.mockResolvedValueOnce({ hits: Array(3).fill({ objectID: 'c1', title: 'Course 1' }) });
      const { ladderTrace } = await courseRetrievalService.fetchCourses(hybridBroadTranslation, mockIndex);
      const attempt = ladderTrace.attempts[0];
      expect(attempt.searchMode).toBe('hybrid-broad');
      expect(attempt.rerankApplied).toBe(true);
      expect(attempt.rerankTrace).toBeDefined();
      expect(attempt.rerankTrace?.inputCount).toBe(3);
      expect(attempt.strictSkillsUsed).toEqual(
        expect.arrayContaining(['Cloud Computing', 'DevOps']),
      );
      expect(attempt.boostSkillsUsed).toEqual(
        expect.arrayContaining(['Python', 'JSON']),
      );
    });

    it('also works for legacy facet-first data (no boost skills)', async () => {
      mockSearch.mockResolvedValueOnce({
        hits: Array(3).fill({ objectID: 'c', title: 'Course' }),
      });

      await courseRetrievalService.fetchCourses(facetFirstTranslation, mockIndex);

      expect(mockSearch).toHaveBeenCalledTimes(1);
      const [, paramsArg] = mockSearch.mock.calls[0];
      expect(paramsArg.facetFilters).toEqual(
        expect.arrayContaining([
          expect.arrayContaining(['skill_names:"Python"', 'skill_names:"SQL"']),
        ]),
      );
      // No boost skills → no optionalFilters from skills
      expect(paramsArg.optionalFilters).toBeUndefined();
    });

    it('treats introductory learners as matching beginner-level courses during reranking', async () => {
      mockSearch.mockResolvedValueOnce({
        hits: [
          {
            objectID: 'intermediate-course',
            title: 'Intermediate Course',
            level_type: 'Intermediate',
          },
          {
            objectID: 'beginner-course',
            title: 'Beginner Course',
            level_type: 'Beginner',
          },
          {
            objectID: 'advanced-course',
            title: 'Advanced Course',
            level_type: 'Advanced',
          },
        ],
      });

      const translation = {
        ...hybridBroadTranslation,
        learnerLevel: 'introductory',
      } as CatalogTranslation;

      const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(translation, mockIndex);

      expect(courses[0].id).toBe('beginner-course');
      expect(ladderTrace.attempts[0].rerankTrace?.courseScores?.[0]).toEqual(
        expect.objectContaining({
          objectID: 'beginner-course',
          levelCompatibility: 'matched',
        }),
      );
    });
  });

  describe('step 2: boosted text fallback', () => {
    it('uses query + optionalFilters (boost only) with no skill facetFilters when step 1 misses', async () => {
      mockSearch.mockResolvedValueOnce({ hits: [] }); // step 1: miss
      mockSearch.mockResolvedValueOnce({ hits: Array(4).fill({ objectID: 'c', title: 'Course' }) }); // step 2: hit

      const { ladderTrace } = await courseRetrievalService.fetchCourses(hybridBroadTranslation, mockIndex);

      expect(mockSearch).toHaveBeenCalledTimes(2);
      const step2Params = mockSearch.mock.calls[1][1];

      // Query must be present (boosted text uses translation.query)
      expect(mockSearch.mock.calls[1][0]).toBeTruthy();

      // Boost optionalFilters must be present
      expect(step2Params.optionalFilters).toEqual(
        expect.arrayContaining(['skill_names:"Python"', 'skill_names:"JSON"']),
      );

      // No extra skill-based facetFilters beyond the base scope group
      const facetFilterStrings = (step2Params.facetFilters as string[][]).flat().join(' ');
      expect(facetFilterStrings).not.toContain('"Cloud Computing"');
      expect(facetFilterStrings).not.toContain('"DevOps"');

      expect(ladderTrace.winnerStep).toBe(2);
      const attempt2 = ladderTrace.attempts[1];
      expect(attempt2.searchMode).toBe('boosted-text');
    });

    it('falls to step 2 for legacy data and preserves base facetFilters without optionalFilters', async () => {
      mockSearch.mockResolvedValueOnce({ hits: [] }); // step 1: miss
      mockSearch.mockResolvedValueOnce({ hits: Array(4).fill({ objectID: 'c', title: 'Course' }) }); // step 2: hit

      const { ladderTrace } = await courseRetrievalService.fetchCourses(facetFirstTranslation, mockIndex);

      expect(mockSearch).toHaveBeenCalledTimes(2);
      const step2Params = mockSearch.mock.calls[1][1];
      expect(step2Params).toHaveProperty('facetFilters'); // base scope facets always present
      expect(step2Params.optionalFilters).toBeUndefined(); // no boost skills in legacy data
      expect(ladderTrace.winnerStep).toBe(2);
    });
  });

  describe('step 3: text fallback', () => {
    it('uses careerTitle from queryAlternates as the text query', async () => {
      // Step 3 iterates [translation.query, ...queryAlternates] — both 'python sql' and 'Software Engineer'
      mockSearch.mockResolvedValueOnce({ hits: [] }); // step 1: miss
      mockSearch.mockResolvedValueOnce({ hits: [] }); // step 2: miss
      mockSearch.mockResolvedValueOnce({ hits: [] }); // step 3a: 'python sql' miss
      mockSearch.mockResolvedValueOnce({ hits: Array(3).fill({ objectID: 'c', title: 'Course' }) }); // step 3b: hit

      const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(facetFirstTranslation, mockIndex);

      expect(mockSearch).toHaveBeenCalledTimes(4);
      // step 3b fires with the queryAlternate (careerTitle)
      expect(mockSearch.mock.calls[3][0]).toBe('Software Engineer');
      expect(courses).toHaveLength(3);
      expect(ladderTrace.winnerStep).toBe(3);
    });

    it('uses query directly when in text-fallback mode (no skills mapped)', async () => {
      mockSearch.mockResolvedValueOnce({ hits: Array(3).fill({ objectID: 'c', title: 'Course' }) });

      const { courses } = await courseRetrievalService.fetchCourses(textFallbackTranslation, mockIndex);
      expect(courses).toHaveLength(3);
    });
  });

  describe('step 4: scope-only fallback', () => {
    it('returns scope-only results when all earlier steps produce too few results', async () => {
      // facetFirstTranslation: query='python sql', queryAlternates=['Software Engineer']
      // Step 3 iterates both → 2 search calls before step 4
      mockSearch
        .mockResolvedValueOnce({ hits: [] }) // step 1: miss
        .mockResolvedValueOnce({ hits: [] }) // step 2: miss
        .mockResolvedValueOnce({ hits: [] }) // step 3a: 'python sql' miss
        .mockResolvedValueOnce({ hits: [] }) // step 3b: 'Software Engineer' miss
        .mockResolvedValueOnce({ hits: [{ objectID: 'fallback', title: 'Fallback Course' }] }); // step 4

      const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(facetFirstTranslation, mockIndex);
      expect(courses[0].id).toBe('fallback');
      expect(ladderTrace.winnerStep).toBe(4);
      const step4Attempt = ladderTrace.attempts.find((a) => a.step === 4);
      expect(step4Attempt?.searchMode).toBe('scope-only');
    });
  });

  describe('error handling', () => {
    it('returns empty courses and null winnerStep on Algolia error', async () => {
      mockSearch.mockRejectedValueOnce(new Error('Algolia error'));
      const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(facetFirstTranslation, mockIndex);
      expect(courses).toEqual([]);
      expect(ladderTrace.winnerStep).toBeNull();
    });
  });
});
