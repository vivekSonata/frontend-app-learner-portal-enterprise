import { renderHook, act } from '@testing-library/react';
import { usePathways } from '../usePathways';
import { intakePreprocessor } from '../../services/intakePreprocessor';
import { intentExtractionXpertService } from '../../services/intentExtraction.xpert.service';
import { careerRetrievalService } from '../../services/careerRetrieval';
import { courseRetrievalService } from '../../services/courseRetrieval';
import { catalogFacetService } from '../../services/catalogFacetService';
import { catalogTranslationRules } from '../../services/catalogTranslationRules';
import { catalogTranslationService } from '../../services/catalogTranslationService';
import { pathwayAssemblerXpertService } from '../../services/pathwayAssembler.xpert.service';
import useAlgoliaSearch from '../../../app/data/hooks/useAlgoliaSearch';
import useEnterpriseCustomer from '../../../app/data/hooks/useEnterpriseCustomer';
import useSearchCatalogs from '../../../app/data/hooks/useSearchCatalogs';
import useCatalogAlgoliaSearch from '../useCatalogAlgoliaSearch';
import * as appUtils from '../../../app/data/utils';
import {
  mockIntakeInput,
  mockSearchIntent,
} from '../../fixtures';
import { DEFAULT_XPERT_RAG_TAGS } from '../../constants/retrieval.constants';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(() => ({
    ALGOLIA_INDEX_NAME_JOBS: 'test-jobs-index',
    ALGOLIA_INDEX_NAME: 'test-catalog-index',
  })),
}));

jest.mock('../../../app/data/hooks/useAlgoliaSearch', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../app/data/hooks/useEnterpriseCustomer', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../app/data/hooks/useSearchCatalogs', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../hooks/useCatalogAlgoliaSearch', () => ({
  __esModule: true,
  default: jest.fn(() => ({ searchClient: null, searchIndex: null })),
}));
jest.mock('../../services/intakePreprocessor');
jest.mock('../../services/intentExtraction.xpert.service');
jest.mock('../../services/careerRetrieval');
jest.mock('../../services/courseRetrieval');
jest.mock('../../services/catalogFacetService');
jest.mock('../../services/catalogTranslationRules');
jest.mock('../../services/catalogTranslationService');
jest.mock('../../services/pathwayAssembler.xpert.service');

describe('usePathways hook', () => {
  const mockJobIndex = { search: jest.fn() };
  const mockCatalogIndex = { search: jest.fn() };

  const mockCareers = [
    {
      id: '1', title: 'Software Engineer', skills: ['JavaScript', 'React'], industries: ['Tech'],
    },
  ];

  const mockCourses = [
    {
      id: 'c1', title: 'React Basics', skills: ['React'], level: 'beginner', order: 1,
    },
  ];

  const mockFacetSnapshot = {
    skill_names: ['JavaScript', 'React'],
    'skills.name': [],
    subjects: [],
    level_type: [],
    'partners.name': [],
    enterprise_catalog_query_uuids: [],
  };

  const mockRulesFirst = {
    exactMatches: ['JavaScript'],
    aliasMatches: [],
    exactSkillFilters: [
      {
        taxonomySkill: 'JavaScript', catalogSkill: 'JavaScript', catalogField: 'skill_names', matchMethod: 'exact',
      },
    ],
    aliasSkillFilters: [],
    unmatched: [],
  };

  const mockTranslation = {
    query: '',
    queryAlternates: ['Software Engineer'],
    strictSkillFilters: mockRulesFirst.exactSkillFilters,
    boostSkillFilters: [],
    droppedTaxonomySkills: [],
    skillProvenance: [],
  };

  beforeEach(() => {
    jest.spyOn(appUtils, 'getSupportedLocale').mockReturnValue('en');
    jest.clearAllMocks();

    (useAlgoliaSearch as jest.Mock).mockImplementation((indexName) => {
      if (indexName === 'test-jobs-index') {
        return { searchIndex: mockJobIndex };
      }
      return {
        searchIndex: mockCatalogIndex,
        catalogUuidsToCatalogQueryUuids: {},
        shouldUseSecuredAlgoliaApiKey: false,
      };
    });

    (useEnterpriseCustomer as jest.Mock).mockReturnValue({ data: { uuid: 'ent-123' } });
    (useSearchCatalogs as jest.Mock).mockReturnValue(['cat-1']);
    (useCatalogAlgoliaSearch as jest.Mock).mockReturnValue({ searchClient: null, searchIndex: null });

    (intakePreprocessor.preprocessInput as jest.Mock).mockReturnValue('preprocessed-input');
    (intentExtractionXpertService.extractIntent as jest.Mock).mockResolvedValue({
      intent: mockSearchIntent,
      debug: {
        durationMs: 100, success: true, systemPrompt: '', rawResponse: '', parsedResponse: {}, validationErrors: [], repairPromptUsed: false,
      },
    });

    (careerRetrievalService.searchCareers as jest.Mock).mockResolvedValue({ careers: mockCareers, trace: {} });
    (catalogFacetService.getFacetSnapshot as jest.Mock).mockResolvedValue({
      snapshot: mockFacetSnapshot, trace: {},
    });
    (catalogTranslationRules.translateTaxonomyToCatalog as jest.Mock).mockReturnValue({
      result: mockRulesFirst, trace: {},
    });
    (catalogTranslationService.processTranslation as jest.Mock).mockReturnValue({
      translation: mockTranslation, trace: { courseSearchMode: 'facet-first', facetMatchCount: 1, facetMatchRate: 1 },
    });
    (courseRetrievalService.fetchCourses as jest.Mock).mockResolvedValue({ courses: mockCourses, ladderTrace: {} });
    (pathwayAssemblerXpertService.enrichWithReasoning as jest.Mock).mockResolvedValue({
      pathway: { courses: mockCourses },
      debug: {
        durationMs: 200, success: true, systemPrompt: '', rawResponse: '',
      },
    });
  });

  it('orchestrates the full flow: profile generation', async () => {
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    expect(intakePreprocessor.preprocessInput).toHaveBeenCalledWith(mockIntakeInput);
    expect(intentExtractionXpertService.extractIntent).toHaveBeenCalled();
    expect(careerRetrievalService.searchCareers).toHaveBeenCalled();

    expect(result.current.currentStep).toBe('profile');
    expect(result.current.learnerProfile?.careerMatches).toHaveLength(1);
    expect(result.current.selectedCareer?.title).toBe('Software Engineer');
  });

  it('orchestrates the full flow: pathway generation without Xpert translation', async () => {
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    expect(result.current.currentStep).toBe('profile');

    await act(async () => {
      await result.current.generatePathway();
    });

    // Facet snapshot called with config, context, and the active catalog index
    expect(catalogFacetService.getFacetSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ enterpriseCustomerUuid: 'ent-123', locale: 'en' }),
      mockCatalogIndex,
    );
    expect(catalogTranslationRules.translateTaxonomyToCatalog).toHaveBeenCalled();
    // processTranslation called with 3 args: careerTitle + rulesFirst + options
    expect(catalogTranslationService.processTranslation).toHaveBeenCalledWith(
      'Software Engineer',
      expect.anything(),
      expect.objectContaining({ intentRequiredSkills: expect.any(Array) }),
    );
    // fetchCourses called with translation + catalogIndex
    // (useCatalogAlgoliaSearch returns null → fallback to mockCatalogIndex)
    expect(courseRetrievalService.fetchCourses).toHaveBeenCalledWith(expect.anything(), mockCatalogIndex);
    expect(pathwayAssemblerXpertService.enrichWithReasoning).toHaveBeenCalled();

    expect(result.current.currentStep).toBe('pathway');
    expect(result.current.pathway?.courses).toHaveLength(1);
  });

  it('uses the catalog override index for facet snapshot retrieval when available', async () => {
    const overrideCatalogIndex = { search: jest.fn() };
    (useCatalogAlgoliaSearch as jest.Mock).mockReturnValue({
      searchClient: {},
      searchIndex: overrideCatalogIndex,
    });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    await act(async () => {
      await result.current.generatePathway();
    });

    expect(catalogFacetService.getFacetSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ enterpriseCustomerUuid: 'ent-123', locale: 'en' }),
      overrideCatalogIndex,
    );
  });

  it('handles errors gracefully during profile generation', async () => {
    (careerRetrievalService.searchCareers as jest.Mock).mockRejectedValue(new Error('Algolia search failed'));

    const { result } = renderHook(() => usePathways());

    await act(async () => {
      try {
        await result.current.generateProfile(mockIntakeInput);
      } catch (e) {
        // Expected
      }
    });

    expect(result.current.error?.message).toBe('Algolia search failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('resets state correctly', async () => {
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    expect(result.current.currentStep).toBe('profile');

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentStep).toBe('intake');
    expect(result.current.learnerProfile).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prompt interception integration tests
// ---------------------------------------------------------------------------

describe('usePathways — prompt interception', () => {
  const mockJobIndex = { search: jest.fn() };
  const mockCatalogIndex = { search: jest.fn() };

  const mockCareers = [
    {
      id: '1', title: 'Software Engineer', skills: ['JavaScript', 'React'], industries: ['Tech'],
    },
  ];

  const mockCourses = [
    {
      id: 'c1', title: 'React Basics', skills: ['React'], level: 'beginner', order: 1,
    },
  ];

  const mockTranslation = {
    query: '',
    queryAlternates: ['Software Engineer'],
    strictSkillFilters: [],
    boostSkillFilters: [],
    droppedTaxonomySkills: [],
    skillProvenance: [],
  };

  beforeEach(() => {
    jest.spyOn(appUtils, 'getSupportedLocale').mockReturnValue('en');
    jest.clearAllMocks();

    (useAlgoliaSearch as jest.Mock).mockImplementation((indexName) => {
      if (indexName === 'test-jobs-index') {
        return { searchIndex: mockJobIndex };
      }
      return {
        searchIndex: mockCatalogIndex,
        catalogUuidsToCatalogQueryUuids: {},
        shouldUseSecuredAlgoliaApiKey: false,
      };
    });

    (useEnterpriseCustomer as jest.Mock).mockReturnValue({ data: { uuid: 'ent-123' } });
    (useSearchCatalogs as jest.Mock).mockReturnValue(['cat-1']);
    (useCatalogAlgoliaSearch as jest.Mock).mockReturnValue({ searchClient: null, searchIndex: null });

    (intakePreprocessor.preprocessInput as jest.Mock).mockReturnValue('preprocessed-input');
    (intentExtractionXpertService.extractIntent as jest.Mock).mockResolvedValue({
      intent: mockSearchIntent,
      debug: {
        durationMs: 100, success: true, systemPrompt: '', rawResponse: '', parsedResponse: {}, validationErrors: [], repairPromptUsed: false,
      },
    });

    (careerRetrievalService.searchCareers as jest.Mock).mockResolvedValue({ careers: mockCareers, trace: {} });

    (catalogFacetService.getFacetSnapshot as jest.Mock).mockResolvedValue({
      snapshot: {
        skill_names: [], 'skills.name': [], subjects: [], level_type: [], 'partners.name': [], enterprise_catalog_query_uuids: [],
      },
      trace: {},
    });
    (catalogTranslationRules.translateTaxonomyToCatalog as jest.Mock).mockReturnValue({
      result: {
        exactMatches: [], aliasMatches: [], exactSkillFilters: [], aliasSkillFilters: [], unmatched: [],
      },
      trace: {},
    });
    (catalogTranslationService.processTranslation as jest.Mock).mockReturnValue({
      translation: mockTranslation, trace: { courseSearchMode: 'text-fallback', facetMatchCount: 0, facetMatchRate: 0 },
    });
    (courseRetrievalService.fetchCourses as jest.Mock).mockResolvedValue({ courses: mockCourses, ladderTrace: {} });
    (pathwayAssemblerXpertService.enrichWithReasoning as jest.Mock).mockResolvedValue({
      pathway: { courses: mockCourses },
      debug: {
        durationMs: 200, success: true, systemPrompt: '', rawResponse: '',
      },
    });
  });

  it('does NOT forward interceptor to extractIntent when none is provided', async () => {
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    const callArgs = (intentExtractionXpertService.extractIntent as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toBeUndefined();
    expect(callArgs[2]).toEqual(DEFAULT_XPERT_RAG_TAGS);
  });

  it('forwards a capturing interceptor to extractIntent when one is provided', async () => {
    const mockInterceptPrompt = jest.fn().mockResolvedValue({ decision: 'accepted', bundle: undefined });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput, mockInterceptPrompt);
    });

    const callArgs = (intentExtractionXpertService.extractIntent as jest.Mock).mock.calls[0];
    expect(typeof callArgs[1]).toBe('function');
    expect(callArgs[2]).toEqual(DEFAULT_XPERT_RAG_TAGS);
  });

  it('accept path — interceptor called and extractIntent completes successfully', async () => {
    const mockInterceptPrompt = jest.fn().mockResolvedValue({ decision: 'accepted', bundle: undefined });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput, mockInterceptPrompt);
    });

    expect(intentExtractionXpertService.extractIntent).toHaveBeenCalled();
    expect(result.current.currentStep).toBe('profile');
    expect(result.current.learnerProfile?.careerMatches).toHaveLength(1);
  });

  it('reject path — extractIntent still completes with original bundle', async () => {
    const mockInterceptPrompt = jest.fn().mockResolvedValue({ decision: 'rejected', bundle: undefined });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput, mockInterceptPrompt);
    });

    expect(intentExtractionXpertService.extractIntent).toHaveBeenCalled();
    expect(result.current.currentStep).toBe('profile');
  });

  it('cancel path — generateProfile rejects when extractIntent throws', async () => {
    (intentExtractionXpertService.extractIntent as jest.Mock).mockRejectedValue(
      new Error('cancelled by user'),
    );

    const mockInterceptPrompt = jest.fn().mockResolvedValue({ decision: 'cancelled', bundle: undefined });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      try {
        await result.current.generateProfile(mockIntakeInput, mockInterceptPrompt);
      } catch {
        // expected
      }
    });

    expect(result.current.error?.message).toBe('cancelled by user');
    expect(result.current.currentStep).toBe('intake');
  });

  it('enrichment stage — interceptor is forwarded to enrichWithReasoning', async () => {
    const mockInterceptPrompt = jest.fn().mockResolvedValue({ decision: 'accepted', bundle: undefined });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput, mockInterceptPrompt);
    });

    await act(async () => {
      await result.current.generatePathway();
    });

    const enrichCallArgs = (pathwayAssemblerXpertService.enrichWithReasoning as jest.Mock).mock.calls[0];
    expect(typeof enrichCallArgs[2]).toBe('function');
    expect(enrichCallArgs[3]).toEqual(DEFAULT_XPERT_RAG_TAGS);
  });
});
