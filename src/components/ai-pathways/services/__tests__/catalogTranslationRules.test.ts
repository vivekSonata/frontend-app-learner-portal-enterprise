import { catalogTranslationRules } from '../catalogTranslationRules';
import { CatalogFacetSnapshot, TaxonomyTranslationInput } from '../../types';

describe('catalogTranslationRules', () => {
  const mockFacetSnapshot: CatalogFacetSnapshot = {
    skill_names: ['Python (Programming Language)', 'Java', 'SQL (Programming Language)'],
    'skills.name': ['Machine Learning'],
    subjects: ['Data Science', 'Computer Science'],
    level_type: ['introductory'],
    'partners.name': ['Coursera'],
    enterprise_catalog_query_uuids: ['ent-123'],
  };

  const defaultInput: TaxonomyTranslationInput = {
    careerTitle: 'Data Scientist',
    skills: ['Python', 'R', 'SQL'],
    industries: ['Tech'],
    similarJobs: ['Data Analyst'],
    facetSnapshot: mockFacetSnapshot,
  };

  it('handles exact matches (case-insensitive)', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['java', 'MACHINE LEARNING'], // Mixed case
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    expect(result.exactMatches).toContain('Java');
    expect(result.exactMatches).toContain('Machine Learning');
    expect(result.exactMatches).toHaveLength(2);
  });

  it('handles alias matches', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['Python', 'SQL'],
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    // Python -> Python (Programming Language)
    // SQL -> SQL (Programming Language)
    expect(result.aliasMatches).toContain('Python (Programming Language)');
    expect(result.aliasMatches).toContain('SQL (Programming Language)');
    expect(result.aliasMatches).toHaveLength(2);
  });

  it('handles Front End / Frontend alias', () => {
    const snapshotWithFrontEnd: CatalogFacetSnapshot = {
      ...mockFacetSnapshot,
      skill_names: ['Front End (Software Engineering)'],
    };

    const input1: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['Front End'],
      facetSnapshot: snapshotWithFrontEnd,
    };
    const input2: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['frontend'],
      facetSnapshot: snapshotWithFrontEnd,
    };

    const { result: result1 } = catalogTranslationRules.translateTaxonomyToCatalog(input1);
    const { result: result2 } = catalogTranslationRules.translateTaxonomyToCatalog(input2);

    expect(result1.aliasMatches).toContain('Front End (Software Engineering)');
    expect(result2.aliasMatches).toContain('Front End (Software Engineering)');
  });

  it('handles unmatched terms', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['Creative Writing', 'Underwater Basket Weaving'],
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    expect(result.unmatched).toContain('Creative Writing');
    expect(result.unmatched).toContain('Underwater Basket Weaving');
  });

  it('trims and dedupes terms', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      careerTitle: ' Java ',
      skills: ['java', ' JAVA '],
      industries: [],
      similarJobs: [],
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    expect(result.exactMatches).toEqual(['Java']);
    expect(result.exactMatches).toHaveLength(1);
  });

  it('ignores alias matches if target is not in catalog', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['Python'],
      facetSnapshot: {
        ...mockFacetSnapshot,
        skill_names: [], // Python (Programming Language) is missing
      },
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    expect(result.aliasMatches).toHaveLength(0);
    expect(result.unmatched).toContain('Python');
  });

  it('sorts results alphabetically', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['SQL', 'Python', 'Java'],
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    expect(result.exactMatches).toEqual(['Java']);
    expect(result.aliasMatches).toEqual(['Python (Programming Language)', 'SQL (Programming Language)']);
  });

  it('attaches broad_anchor tier metadata when intentRequiredSkills match catalog', () => {
    const snapshotWithBroadSkills: CatalogFacetSnapshot = {
      ...mockFacetSnapshot,
      skill_names: ['Cloud Computing', 'DevOps', 'Python (Programming Language)'],
    };
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: [],
      intentRequiredSkills: ['Cloud Computing', 'DevOps'],
      intentPreferredSkills: ['Python'],
      facetSnapshot: snapshotWithBroadSkills,
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);

    const broadFilters = result.exactSkillFilters.filter((f) => f.tier === 'broad_anchor');
    expect(broadFilters.map((f) => f.catalogSkill)).toContain('Cloud Computing');
    expect(broadFilters.map((f) => f.catalogSkill)).toContain('DevOps');
  });

  it('attaches narrow_signal tier to intentPreferredSkills', () => {
    const snapshotWithPython: CatalogFacetSnapshot = {
      ...mockFacetSnapshot,
      skill_names: ['Python (Programming Language)'],
    };
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: [],
      intentPreferredSkills: ['Python'],
      facetSnapshot: snapshotWithPython,
    };

    const { result } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const pythonFilter = result.aliasSkillFilters.find(
      (f) => f.catalogSkill === 'Python (Programming Language)',
    );
    expect(pythonFilter?.tier).toBe('narrow_signal');
  });

  it('populates tieringTrace in the returned trace', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      intentRequiredSkills: ['Cloud Computing'],
      skills: ['Java'],
      facetSnapshot: {
        ...mockFacetSnapshot,
        skill_names: ['Java', 'Cloud Computing'],
      },
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    expect(trace.tieringTrace).toBeDefined();
    expect(trace.tieringTrace!.length).toBeGreaterThan(0);

    const cloudTrace = trace.tieringTrace!.find((t) => t.name === 'Cloud Computing');
    expect(cloudTrace?.tier).toBe('broad_anchor');
  });

  it('excludes noise (malformed compound) from termsToTranslate', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['AutomationSQL & Python'],
    };

    const { result, trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    expect(result.exactSkillFilters).toHaveLength(0);
    expect(result.aliasSkillFilters).toHaveLength(0);
    expect(trace.noiseDropped).toContain('AutomationSQL & Python');
  });

  it('tieringTrace entries have decision=strict for broad_anchor matched skills', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      intentRequiredSkills: ['Cloud Computing'],
      skills: [],
      facetSnapshot: {
        ...mockFacetSnapshot,
        skill_names: ['Cloud Computing'],
      },
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const cloudEntry = trace.tieringTrace!.find((t) => t.name === 'Cloud Computing');
    expect(cloudEntry?.decision).toBe('strict');
    expect(cloudEntry?.catalogSkill).toBe('Cloud Computing');
    expect(cloudEntry?.matchMethod).toBe('exact');
    expect(cloudEntry?.normalizedName).toBeDefined();
  });

  it('tieringTrace entries have decision=boost for narrow_signal matched skills', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      intentPreferredSkills: ['Python'],
      skills: [],
      facetSnapshot: {
        ...mockFacetSnapshot,
        skill_names: ['Python'],
      },
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const pythonEntry = trace.tieringTrace!.find((t) => t.name === 'Python');
    expect(pythonEntry?.tier).toBe('narrow_signal');
    expect(pythonEntry?.decision).toBe('boost');
  });

  it('tieringTrace entries have decision=dropped for noise tier', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      skills: ['AutomationSQL & Python'],
      facetSnapshot: mockFacetSnapshot,
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const noiseEntry = trace.tieringTrace!.find((t) => t.name === 'AutomationSQL & Python');
    expect(noiseEntry?.tier).toBe('noise');
    expect(noiseEntry?.decision).toBe('dropped');
  });

  it('tieringTrace entries have decision=unmatched for non-noise unmatched skills', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      intentRequiredSkills: ['Quantum Computing'],
      skills: [],
      facetSnapshot: { ...mockFacetSnapshot, skill_names: [] },
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const quantumEntry = trace.tieringTrace!.find((t) => t.name === 'Quantum Computing');
    expect(quantumEntry?.decision).toBe('unmatched');
    expect(quantumEntry?.catalogSkill).toBeUndefined();
  });

  it('tieringTrace entries include uniquePostings and typeName from skillDetails', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      intentRequiredSkills: [],
      skills: ['Python'],
      skillDetails: [
        {
          name: 'Python',
          significance: 1200,
          unique_postings: 50000,
          type_name: 'Common Skill',
        },
      ],
      facetSnapshot: { ...mockFacetSnapshot, skill_names: ['Python'] },
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    const pythonEntry = trace.tieringTrace!.find((t) => t.name === 'Python');
    expect(pythonEntry?.uniquePostings).toBe(50000);
    expect(pythonEntry?.typeName).toBe('Common Skill');
    expect(pythonEntry?.significance).toBe(1200);
  });

  it('populates roleDifferentiatorMatches and narrowSignalMatches in trace', () => {
    const input: TaxonomyTranslationInput = {
      ...defaultInput,
      intentRequiredSkills: ['Cloud Computing'],
      intentPreferredSkills: ['Python'],
      skills: [],
      facetSnapshot: {
        ...mockFacetSnapshot,
        skill_names: ['Cloud Computing', 'Python'],
      },
    };

    const { trace } = catalogTranslationRules.translateTaxonomyToCatalog(input);
    expect(trace.narrowSignalMatches).toContain('Python');
    expect(trace.strictCandidateCount).toBeGreaterThanOrEqual(1);
    expect(trace.boostCandidateCount).toBeGreaterThanOrEqual(1);
  });
});
