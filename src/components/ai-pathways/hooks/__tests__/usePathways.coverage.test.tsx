import { renderHook, act } from '@testing-library/react';
import { AppContext } from '@edx/frontend-platform/react';
import React from 'react';
import { usePathways } from '../usePathways';
import { intakePreprocessor } from '../../services/intakePreprocessor';
import { intentExtractionXpertService } from '../../services/intentExtraction.xpert.service';
import { careerRetrievalService } from '../../services/careerRetrieval';
import useAlgoliaSearch from '../../../app/data/hooks/useAlgoliaSearch';
import * as appUtils from '../../../app/data/utils';
import { mockIntakeInput, mockSearchIntent } from '../../fixtures';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(() => ({
    ALGOLIA_INDEX_NAME_JOBS: 'test-jobs-index',
    ALGOLIA_INDEX_NAME: 'test-catalog-index',
  })),
}));

jest.mock('../../../app/data/hooks/useAlgoliaSearch', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../app/data/hooks/useEnterpriseCustomer', () => ({ __esModule: true, default: jest.fn(() => ({ data: {} })) }));
jest.mock('../../../app/data/hooks/useSearchCatalogs', () => ({ __esModule: true, default: jest.fn(() => []) }));
jest.mock('../../services/intakePreprocessor');
jest.mock('../../services/intentExtraction.xpert.service');
jest.mock('../../services/careerRetrieval');
jest.mock('../../services/courseRetrieval');
jest.mock('../../services/catalogFacetService');
jest.mock('../../hooks/useCatalogAlgoliaSearch', () => ({
  __esModule: true,
  default: jest.fn(() => ({ searchClient: null, searchIndex: null })),
}));
jest.mock('../../services/catalogTranslationRules');
jest.mock('../../services/catalogTranslationService');
jest.mock('../../services/pathwayAssembler.xpert.service');

describe('usePathways coverage gaps', () => {
  const mockJobIndex = { search: jest.fn() };

  beforeEach(() => {
    jest.spyOn(appUtils, 'getSupportedLocale').mockReturnValue('en');
    jest.clearAllMocks();
    (useAlgoliaSearch as jest.Mock).mockImplementation((indexName) => {
      if (indexName === 'test-jobs-index') {
        return { searchIndex: mockJobIndex };
      }
      return { searchIndex: {} };
    });
    (intakePreprocessor.preprocessInput as jest.Mock).mockReturnValue({});
    (intentExtractionXpertService.extractIntent as jest.Mock).mockResolvedValue({
      intent: mockSearchIntent,
      debug: {},
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppContext.Provider value={{ authenticatedUser: { name: 'Test User', username: 'testuser' } } as any}>
      {children}
    </AppContext.Provider>
  );

  it('throws error if jobIndex is missing', async () => {
    (useAlgoliaSearch as jest.Mock).mockReturnValue({ searchIndex: null });
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await expect(result.current.generateProfile(mockIntakeInput)).rejects.toThrow('Search index not initialized');
    });
  });

  it('handles case with no career matches', async () => {
    (careerRetrievalService.searchCareers as jest.Mock).mockResolvedValue({ careers: [], trace: {} });
    const { result } = renderHook(() => usePathways(), { wrapper });

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    expect(result.current.learnerProfile?.overview).toContain("We couldn't find exact matches");
    expect(result.current.selectedCareer).toBeNull();
  });

  it('uses username if name is missing', async () => {
    (careerRetrievalService.searchCareers as jest.Mock).mockResolvedValue({ careers: [{ title: 'Dev' }], trace: {} });
    const { result } = renderHook(() => usePathways(), {
      wrapper: ({ children }: any) => (
        <AppContext.Provider value={{ authenticatedUser: { username: 'only-username' } } as any}>
          {children}
        </AppContext.Provider>
      ),
    });

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    expect(result.current.learnerProfile?.name).toBe('only-username');
  });

  it('handles selectCareer when career is not found in rawCareers', async () => {
    (careerRetrievalService.searchCareers as jest.Mock).mockResolvedValue({ careers: [{ title: 'Dev' }], trace: {} });
    const { result } = renderHook(() => usePathways(), { wrapper });

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput);
    });

    act(() => {
      result.current.selectCareer({ title: 'Non-Existent' } as any);
    });

    expect(result.current.selectedCareer).toBeNull();
  });

  it('throws error in generatePathway if essential data is missing', async () => {
    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await expect(result.current.generatePathway()).rejects.toThrow('Missing data or search index to generate pathway');
    });
  });

  it('capturing interceptor handles edited bundle and validation warnings', async () => {
    const mockBundle = { combined: 'original' };
    const editedBundle = { combined: 'edited' };
    const mockInterceptPrompt = jest.fn().mockResolvedValue({
      decision: 'accepted',
      bundle: editedBundle,
      validationWarnings: [{ message: 'warn' }],
    });

    const { result } = renderHook(() => usePathways());

    await act(async () => {
      await result.current.generateProfile(mockIntakeInput, mockInterceptPrompt);
    });

    const interceptor = (intentExtractionXpertService.extractIntent as jest.Mock).mock.calls[0][1];
    await interceptor(mockBundle, { label: 'test' });

    // Verify debug log contains edited bundle and warnings
    expect(result.current.pathwayResponse?.promptDebug?.[0]).toMatchObject({
      label: 'test',
      decision: 'accepted',
      edited: editedBundle,
      validationWarnings: [{ message: 'warn' }],
    });
  });
});
