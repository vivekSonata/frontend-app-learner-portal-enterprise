import { careerRetrievalService } from '../careerRetrieval';

describe('careerRetrieval coverage gaps', () => {
  const mockIndex = { search: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildCareerQuery falls back to roles or skills when condensedQuery is missing', async () => {
    const intent = {
      condensedQuery: '',
      roles: ['Dev'],
      skillsRequired: ['JS'],
    };
    mockIndex.search.mockResolvedValue({ hits: [] });

    await careerRetrievalService.searchCareers(mockIndex, intent as any);
    expect(mockIndex.search).toHaveBeenCalledWith('Dev', expect.anything());

    const intent2 = {
      condensedQuery: '',
      roles: [],
      skillsRequired: ['JS'],
    };
    await careerRetrievalService.searchCareers(mockIndex, intent2 as any);
    expect(mockIndex.search).toHaveBeenCalledWith('JS', expect.anything());
  });

  it('buildFilters handles excludeTags', async () => {
    const intent = {
      condensedQuery: 'test',
      excludeTags: ['tag1', 'tag"2'],
    };
    mockIndex.search.mockResolvedValue({ hits: [] });

    await careerRetrievalService.searchCareers(mockIndex, intent as any);
    const { filters } = mockIndex.search.mock.calls[0][1];
    expect(filters).toContain('NOT skills.name:"tag1"');
    expect(filters).toContain('NOT skills.name:"tag\\"2"');
  });

  it('mapTaxonomyResultToCareerCard handles missing fields', async () => {
    const hit = {
      objectID: 'obj-1',
      name: 'Role',
      // missing id, job_postings
    };
    mockIndex.search.mockResolvedValue({ hits: [hit] });

    const { careers } = await careerRetrievalService.searchCareers(mockIndex, { condensedQuery: 'test' } as any);
    expect(careers[0].id).toBe('obj-1');
    // @ts-ignore
    expect(careers[0].marketData.medianSalary).toBeUndefined();
  });

  it('dedupeStrings removes duplicates and empties', async () => {
    const intent = {
      condensedQuery: 'test',
      industries: ['Tech', 'Tech', '  ', null],
    };
    mockIndex.search.mockResolvedValue({ hits: [] });

    await careerRetrievalService.searchCareers(mockIndex, intent as any);
    const { filters } = mockIndex.search.mock.calls[0][1];
    expect(filters).toBe('(industry_names:"Tech")');
  });
});
