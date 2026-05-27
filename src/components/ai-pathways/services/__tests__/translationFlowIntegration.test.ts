import { catalogTranslationRules } from '../catalogTranslationRules';
import { catalogTranslationService } from '../catalogTranslationService';
import { courseRetrievalService } from '../courseRetrieval';
import {
  CatalogFacetSnapshot, TaxonomyTranslationInput,
} from '../../types';

const mockSearch = jest.fn();
const mockIndex = { search: mockSearch } as any;

describe('Translation and Retrieval Integration Flow', () => {
  const mockFacetSnapshot: CatalogFacetSnapshot = {
    skill_names: ['Python (Programming Language)', 'Data Analysis', 'SQL (Programming Language)'],
    'skills.name': ['Python Programming'],
    subjects: ['Computer Science', 'Data Science'],
    level_type: ['Introductory'],
    'partners.name': ['edX'],
    enterprise_catalog_query_uuids: ['uuid-1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseInput: TaxonomyTranslationInput = {
    careerTitle: 'Data Analyst',
    skills: [],
    industries: [],
    similarJobs: [],
    facetSnapshot: mockFacetSnapshot,
  };

  it('exact skill mapping: matches taxonomy skill directly to catalog facet, uses facet-first', async () => {
    const input = { ...baseInput, skills: ['Data Analysis'] };

    const { result: rulesResult } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    expect(rulesResult.exactMatches).toContain('Data Analysis');

    const { translation, trace } = catalogTranslationService.processTranslation(
      input.careerTitle,
      rulesResult,
    );
    // Query is now built from mapped skill names (not an empty string)
    expect(translation.query).toBe('data analysis');
    expect(translation.strictSkillFilters.map((f) => f.catalogSkill)).toContain('Data Analysis');
    expect(trace.courseSearchMode).toBe('facet-first');

    mockSearch.mockResolvedValueOnce({
      hits: Array(3).fill({ objectID: 'c1', title: 'Data Analysis Course' }),
    });

    const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(translation, mockIndex);

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('data analysis', expect.objectContaining({
      facetFilters: expect.arrayContaining([
        expect.arrayContaining(['skill_names:"Data Analysis"']),
      ]),
    }));
    expect(courses).toHaveLength(3);
    expect(ladderTrace.winnerStep).toBe(1);
  });

  it('alias mapping: maps "Python" to "Python (Programming Language)" via alias map', async () => {
    const input = { ...baseInput, skills: ['Python'] };

    const { result: rulesResult } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    expect(rulesResult.aliasMatches).toContain('Python (Programming Language)');

    const { translation, trace } = catalogTranslationService.processTranslation(
      input.careerTitle,
      rulesResult,
    );
    expect(translation.strictSkillFilters.map((f) => f.catalogSkill)).toContain('Python (Programming Language)');
    expect(trace.courseSearchMode).toBe('facet-first');

    mockSearch.mockResolvedValueOnce({
      hits: Array(3).fill({ objectID: 'c1', title: 'Python Course' }),
    });

    const { courses } = await courseRetrievalService.fetchCourses(translation, mockIndex);

    expect(courses).toHaveLength(3);
  });

  it('no skill mapping: falls back to text-fallback mode using careerTitle', async () => {
    const input = { ...baseInput, skills: ['ObscureTechNotInCatalog'] };

    const { result: rulesResult } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    const { translation, trace } = catalogTranslationService.processTranslation(
      input.careerTitle,
      rulesResult,
    );
    expect(translation.query).toBe('Data Analyst');
    expect(translation.strictSkillFilters).toHaveLength(0);
    expect(trace.courseSearchMode).toBe('text-fallback');
  });

  it('step 1 fails, step 2 (boosted text fallback) succeeds without skill facetFilters', async () => {
    const input = { ...baseInput, skills: ['Data Analysis', 'SQL'] };

    const { result: rulesResult } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const { translation } = catalogTranslationService.processTranslation(
      input.careerTitle,
      rulesResult,
    );

    mockSearch.mockResolvedValueOnce({ hits: [] }); // step 1: miss
    mockSearch.mockResolvedValueOnce({ hits: Array(4).fill({ objectID: 'c2', title: 'Course' }) }); // step 2: hit

    const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(translation, mockIndex);

    expect(courses).toHaveLength(4);
    expect(ladderTrace.winnerStep).toBe(2);

    // Step 2 (boosted text) must NOT include skill-specific facetFilters — only base scope facets
    const step2Params = mockSearch.mock.calls[1][1];
    const facetStrings = (step2Params.facetFilters as string[][]).flat().join(' ');
    expect(facetStrings).not.toContain('"Data Analysis"');
    expect(facetStrings).not.toContain('"SQL');
  });

  it('scope-only final fallback: all specific levels fail, returns scope-only results', async () => {
    const input = { ...baseInput, skills: ['Data Analysis'] };
    const { result: rulesResult } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const { translation } = catalogTranslationService.processTranslation(input.careerTitle, rulesResult);

    // translation.query = 'data analysis', queryAlternates = ['Data Analyst']
    // Step 3 iterates both → 2 search calls before step 4
    mockSearch
      .mockResolvedValueOnce({ hits: [] }) // step 1: miss
      .mockResolvedValueOnce({ hits: [] }) // step 2: miss
      .mockResolvedValueOnce({ hits: [] }) // step 3a: 'data analysis' miss
      .mockResolvedValueOnce({ hits: [] }) // step 3b: 'Data Analyst' miss
      .mockResolvedValueOnce({ hits: Array(2).fill({ objectID: 'f1', title: 'Fallback Course' }) }); // step 4

    const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(translation, mockIndex);

    expect(courses[0].title).toBe('Fallback Course');
    expect(ladderTrace.winnerStep).toBe(4);
  });

  it('Full Stack JS Engineer: granular skills become boosts not strict filters', async () => {
    const fullStackSnapshot: CatalogFacetSnapshot = {
      skill_names: [
        'Software Development', 'Cloud Computing', 'DevOps',
        'Data Storage Technologies', 'Platform as a Service (PaaS)',
        'JSON', 'Software Quality (SQA/SQC)',
      ],
      'skills.name': [],
      subjects: ['Computer Science'],
      level_type: ['Intermediate'],
      'partners.name': [],
      enterprise_catalog_query_uuids: ['uuid-1'],
    };

    const input: TaxonomyTranslationInput = {
      careerTitle: 'Full Stack JavaScript Engineer',
      skills: [],
      skillDetails: [
        {
          name: 'Data Storage Technologies',
          type_name: 'Common Skill',
          significance: 1146,
          unique_postings: 15000,
        },
        {
          name: 'Platform as a Service (PaaS)',
          type_name: 'Software Product',
          significance: 1080,
          unique_postings: 8000,
        },
        {
          name: 'JSON',
          type_name: 'Specialized Skill',
          significance: 688,
          unique_postings: 5000,
        },
        {
          name: 'Software Quality (SQA/SQC)',
          type_name: 'Specialized Skill',
          significance: 684,
          unique_postings: 4000,
        },
      ],
      intentRequiredSkills: ['Software Development', 'Cloud Computing', 'DevOps'],
      intentPreferredSkills: [],
      industries: [],
      similarJobs: [],
      facetSnapshot: fullStackSnapshot,
    };

    const { result: rulesResult } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const { translation, trace } = catalogTranslationService.processTranslation(
      input.careerTitle,
      rulesResult,
      { intentRequiredSkills: input.intentRequiredSkills },
    );

    // Broad anchors in strictSkillFilters only
    const strictNames = translation.strictSkillFilters.map((f) => f.catalogSkill);
    expect(strictNames).toContain('Cloud Computing');
    expect(strictNames).toContain('DevOps');
    expect(strictNames).toContain('Software Development');
    expect(strictNames).not.toContain('JSON');
    expect(strictNames).not.toContain('Platform as a Service (PaaS)');

    // Granular skills in boostSkillFilters
    const boostNames = translation.boostSkillFilters.map((f) => f.catalogSkill);
    expect(boostNames).toContain('JSON');
    expect(boostNames).toContain('Platform as a Service (PaaS)');
    expect(boostNames).toContain('Software Quality (SQA/SQC)');

    // Query comes from intentRequiredSkills, not empty
    expect(translation.query).toBe('software development cloud computing devops');

    // Mode is hybrid-broad (both strict and boost are non-empty)
    expect(trace.courseSearchMode).toBe('hybrid-broad');

    // Course retrieval step 1: broad anchors in facetFilters, granular in optionalFilters
    mockSearch.mockResolvedValueOnce({
      hits: Array(4).fill({ objectID: 'c1', title: 'Cloud Course' }),
    });

    const { ladderTrace } = await courseRetrievalService.fetchCourses(translation, mockIndex);

    expect(ladderTrace.winnerStep).toBe(1);
    const [queryArg, paramsArg] = mockSearch.mock.calls[0];

    // Non-empty query used
    expect(queryArg).toBe('software development cloud computing devops');

    // facetFilters: broad anchors present, granular skills absent
    const facetStrings = (paramsArg.facetFilters as string[][]).flat().join(' ');
    expect(facetStrings).toContain('"Cloud Computing"');
    expect(facetStrings).toContain('"DevOps"');
    expect(facetStrings).not.toContain('"JSON"');
    expect(facetStrings).not.toContain('"Platform as a Service (PaaS)"');

    // optionalFilters: granular skills present
    const optionalFilters = paramsArg.optionalFilters as string[];
    expect(optionalFilters.some((f: string) => f.includes('"JSON"'))).toBe(true);
    expect(optionalFilters.some((f: string) => f.includes('"Platform as a Service (PaaS)"'))).toBe(true);
  });
});
