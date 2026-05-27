import { SearchIndex } from 'algoliasearch/lite';
import { careerRetrievalService } from '../careerRetrieval';
import { DEFAULT_INTENT } from '../../constants';

describe('careerRetrievalService', () => {
  const mockIndex = {
    search: jest.fn(),
  } as unknown as SearchIndex;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds correct Algolia query from intent', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({
      hits: [
        {
          id: '1',
          name: 'Software Engineer',
          description: 'Build things',
          skills: [{ name: 'React' }],
          industry_names: ['Tech'],
        },
      ],
    });

    const intent = {
      ...DEFAULT_INTENT,
      condensedQuery: 'engineer',
      industries: ['Tech'],
      skillsRequired: ['React'],
    };

    const { careers, trace } = await careerRetrievalService.searchCareers(mockIndex, intent);

    expect(mockIndex.search).toHaveBeenCalledWith('engineer', expect.objectContaining({
      filters: expect.stringContaining('industry_names:"Tech"'),
      optionalFilters: expect.arrayContaining(['skills.name:"React"']),
    }));

    expect(careers).toHaveLength(1);
    expect(careers[0].title).toBe('Software Engineer');
    expect(careers[0].skills).toEqual(['React']);
    expect(trace.query).toBe('engineer');
    expect(trace.requiredSkillFilters).toContain('React');
  });

  it('handles excludeTags in filters', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      excludeTags: ['PHP', 'Ruby'],
    };

    await careerRetrievalService.searchCareers(mockIndex, intent);

    expect(mockIndex.search).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      filters: expect.stringContaining('NOT skills.name:"PHP"'),
    }));
    expect(mockIndex.search).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      filters: expect.stringContaining('NOT skills.name:"Ruby"'),
    }));
  });

  it('caps required skills at CAREER_REQUIRED_OPTIONAL_FILTER_LIMIT (4)', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      skillsRequired: ['SkillA', 'SkillB', 'SkillC', 'SkillD', 'SkillE', 'SkillF'],
    };

    await careerRetrievalService.searchCareers(mockIndex, intent);

    const callArgs = (mockIndex.search as jest.Mock).mock.calls[0][1];
    expect(callArgs.optionalFilters).toHaveLength(4);
  });

  it('excludes preferred skills when learnerLevel is beginner', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      learnerLevel: 'introductory' as const,
      skillsRequired: ['Cloud Computing'],
      skillsPreferred: ['AWS', 'Kubernetes'],
    };

    await careerRetrievalService.searchCareers(mockIndex, intent);

    const callArgs = (mockIndex.search as jest.Mock).mock.calls[0][1];
    const filters: string[] = callArgs.optionalFilters || [];
    expect(filters.some((f) => f.includes('AWS'))).toBe(false);
    expect(filters.some((f) => f.includes('Kubernetes'))).toBe(false);
    expect(filters.some((f) => f.includes('Cloud Computing'))).toBe(true);
  });

  it('includes preferred skills (capped to 2) when learnerLevel is intermediate', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      learnerLevel: 'intermediate' as const,
      skillsRequired: ['Cloud Computing'],
      skillsPreferred: ['AWS', 'Kubernetes', 'Terraform'],
    };

    await careerRetrievalService.searchCareers(mockIndex, intent);

    const callArgs = (mockIndex.search as jest.Mock).mock.calls[0][1];
    const filters: string[] = callArgs.optionalFilters || [];
    // 1 required + 2 preferred (capped) = 3 total
    expect(filters).toHaveLength(3);
  });

  it('filters out malformed compound strings from optionalFilters', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      skillsRequired: ['AutomationSQL & Python', 'Cloud Computing'],
    };

    await careerRetrievalService.searchCareers(mockIndex, intent);

    const callArgs = (mockIndex.search as jest.Mock).mock.calls[0][1];
    const filters: string[] = callArgs.optionalFilters || [];
    expect(filters.some((f) => f.includes('AutomationSQL'))).toBe(false);
    expect(filters.some((f) => f.includes('Cloud Computing'))).toBe(true);
  });

  it('trace.droppedSkillInputs includes malformed compound skills', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      skillsRequired: ['Python & SQL', 'Cloud Computing'],
    };

    const { trace } = await careerRetrievalService.searchCareers(mockIndex, intent);
    const dropped = trace.droppedSkillInputs || [];
    expect(dropped.some((d) => d.skill === 'Python & SQL' && d.reason === 'malformed-compound')).toBe(true);
    expect(dropped.some((d) => d.skill === 'Cloud Computing')).toBe(false);
  });

  it('trace.preferredSkillFilters is empty for beginner learner', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({ hits: [] });

    const intent = {
      ...DEFAULT_INTENT,
      learnerLevel: 'introductory' as const,
      skillsRequired: ['Cloud Computing'],
      skillsPreferred: ['AWS', 'Terraform'],
    };

    const { trace } = await careerRetrievalService.searchCareers(mockIndex, intent);
    expect(trace.preferredSkillFilters).toHaveLength(0);
    const dropped = trace.droppedSkillInputs || [];
    expect(dropped.some((d) => d.skill === 'AWS' && d.reason === 'beginner-level-excluded')).toBe(true);
  });

  it('trace.resultSummaries contains top skills sorted by significance', async () => {
    (mockIndex.search as jest.Mock).mockResolvedValueOnce({
      hits: [{
        id: '10',
        name: 'Data Engineer',
        skills: [
          {
            name: 'SQL', significance: 500, unique_postings: 1000, type_name: 'Common Skill',
          },
          {
            name: 'Python', significance: 900, unique_postings: 2000, type_name: 'Common Skill',
          },
        ],
        industry_names: ['Finance'],
      }],
    });

    const { trace } = await careerRetrievalService.searchCareers(mockIndex, { ...DEFAULT_INTENT, condensedQuery: 'data' });
    const summary = trace.resultSummaries?.[0];
    expect(summary?.skillCount).toBe(2);
    expect(summary?.topSkills?.[0].name).toBe('Python');
    expect(summary?.topSkills?.[0].significance).toBe(900);
  });
});
