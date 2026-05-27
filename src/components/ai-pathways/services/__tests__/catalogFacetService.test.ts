import algoliasearch from 'algoliasearch';
import { catalogFacetService } from '../catalogFacetService';
import { FACET_FIELDS } from '../../constants';

const mockSearch = jest.fn();
const mockInitIndex = jest.fn(() => ({ search: mockSearch }));
jest.mock('algoliasearch', () => jest.fn(() => ({ initIndex: mockInitIndex })));

jest.mock('@edx/frontend-platform/config', () => ({
  getConfig: jest.fn(() => ({
    ALGOLIA_APP_ID: 'test-app-id',
    ALGOLIA_SEARCH_API_KEY: 'test-key',
    ALGOLIA_INDEX_NAME: 'test-index',
  })),
}));

describe('catalogFacetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFacetSnapshot', () => {
    it('fetches facets from Algolia with default content_type filter', async () => {
      const mockResponse = {
        facets: {
          [FACET_FIELDS.SKILL_NAMES]: { Skill1: 10, Skill2: 5 },
          [FACET_FIELDS.SKILLS_DOT_NAME]: { Skill3: 3 },
          [FACET_FIELDS.SUBJECTS]: { Subject1: 1 },
          [FACET_FIELDS.LEVEL_TYPE]: { Beginner: 1 },
          [FACET_FIELDS.PARTNERS_NAME]: { Partner1: 1 },
        },
        hits: [],
        nbHits: 0,
      };
      mockSearch.mockResolvedValue(mockResponse);

      const { snapshot, trace } = await catalogFacetService.getFacetSnapshot();

      expect(mockSearch).toHaveBeenCalledWith('', expect.objectContaining({
        facets: ['*'],
        hitsPerPage: 0,
        facetFilters: [['content_type:course']],
      }));

      expect(snapshot.skill_names).toEqual(['Skill1', 'Skill2']);
      expect(snapshot['skills.name']).toEqual(['Skill3']);
      expect(trace.skillNamesCount).toBe(2);
      expect(trace.sampleSkillNames).toEqual(['Skill1', 'Skill2']);
    });

    it('handles missing facets in Algolia response', async () => {
      mockSearch.mockResolvedValue({
        facets: undefined,
        hits: [],
        nbHits: 0,
      });

      const { snapshot } = await catalogFacetService.getFacetSnapshot();

      expect(snapshot.skill_names).toEqual([]);
      expect(snapshot.subjects).toEqual([]);
    });

    it('applies enterprise catalog UUID filters when context provides catalog mapping', async () => {
      const context = {
        searchCatalogs: ['cat-1'],
        catalogUuidsToCatalogQueryUuids: {
          'cat-1': 'query-uuid-1',
        },
      };

      mockSearch.mockResolvedValue({ facets: {}, hits: [], nbHits: 0 });

      await catalogFacetService.getFacetSnapshot({}, context as any);

      expect(mockSearch).toHaveBeenCalledWith('', expect.objectContaining({
        facetFilters: [
          ['content_type:course'],
          ['enterprise_catalog_query_uuids:query-uuid-1'],
        ],
      }));
    });

    it('omits catalog UUID filters when UUID mapping is absent', async () => {
      const context = {
        searchCatalogs: ['cat-1'],
        // catalogUuidsToCatalogQueryUuids intentionally missing
      };

      mockSearch.mockResolvedValue({ facets: {}, hits: [], nbHits: 0 });

      await catalogFacetService.getFacetSnapshot({}, context as any);

      expect(mockSearch).toHaveBeenCalledWith('', expect.objectContaining({
        facetFilters: [['content_type:course']],
      }));
    });

    it('uses the provided search index instead of constructing the default Algolia index', async () => {
      const explicitIndexSearch = jest.fn().mockResolvedValue({ facets: {}, hits: [], nbHits: 0 });
      const explicitIndex = { search: explicitIndexSearch };

      await catalogFacetService.getFacetSnapshot({}, undefined, explicitIndex as any);

      expect(explicitIndexSearch).toHaveBeenCalledWith('', expect.objectContaining({
        facetFilters: [['content_type:course']],
      }));
      expect(algoliasearch).not.toHaveBeenCalled();
      expect(mockInitIndex).not.toHaveBeenCalled();
    });
  });
});
