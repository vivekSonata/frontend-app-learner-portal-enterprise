import { useMemo } from 'react';
import algoliasearch from 'algoliasearch/lite';
import type { SearchClient, SearchIndex } from 'algoliasearch/lite';
import { getConfig } from '@edx/frontend-platform/config';

type CatalogAlgoliaResult = {
  searchClient: SearchClient | null;
  searchIndex: SearchIndex | null;
};

/**
 * Provides an Algolia search client and index for the course catalog,
 * using the stage override config keys (ALGOLIA_STAGE_APP_ID_OVERRIDE /
 * ALGOLIA_STAGE_SEARCH_API_KEY_OVERRIDE). Returns null for both when
 * either key is absent so callers can fall back gracefully.
 *
 * Shape mirrors useAlgoliaSearch: { searchClient, searchIndex }.
 */
export default function useCatalogAlgoliaSearch(
  indexName: string | null = null,
): CatalogAlgoliaResult {
  const config = getConfig();

  return useMemo(() => {
    const appId = config.ALGOLIA_STAGE_APP_ID_OVERRIDE;
    const apiKey = config.ALGOLIA_STAGE_SEARCH_API_KEY_OVERRIDE;
    const resolvedIndex = indexName || config.ALGOLIA_INDEX_NAME;

    if (!appId || !apiKey || !resolvedIndex) {
      return { searchClient: null, searchIndex: null };
    }

    const client = algoliasearch(appId, apiKey);
    return {
      searchClient: client,
      searchIndex: client.initIndex(resolvedIndex),
    };
  }, [
    config.ALGOLIA_STAGE_APP_ID_OVERRIDE,
    config.ALGOLIA_STAGE_SEARCH_API_KEY_OVERRIDE,
    config.ALGOLIA_INDEX_NAME,
    indexName,
  ]);
}
