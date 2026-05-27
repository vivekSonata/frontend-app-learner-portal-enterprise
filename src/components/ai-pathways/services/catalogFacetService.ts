import { SearchClient, SearchIndex } from 'algoliasearch/lite';
import { getConfig } from '@edx/frontend-platform/config';
import algoliasearch from 'algoliasearch';
import { CatalogFacetSnapshot, FacetRetrievalConfig } from '../types/catalogFacet';
import { FacetBootstrapContext, FacetSnapshotTrace } from '../types';
import {
  MAX_VALUES_PER_FACET,
  CONTENT_TYPE_COURSE,
  FACET_FIELDS,
} from '../constants';

/**
 * Safely extracts the list of facet values for a given key from an Algolia facet response.
 * Returns an empty array when the key is absent or the response is undefined, preventing
 * downstream crashes if the Algolia index schema evolves or a facet has no values.
 *
 * @param facets The raw facets map returned by Algolia (`{ [attr]: { [value]: count } }`).
 * @param key The facet attribute name to read (e.g. `'skill_names'`).
 * @returns An array of facet value strings, or `[]` if the key is missing.
 */
const safeReadFacet = (facets: Record<string, Record<string, number>> | undefined, key: string): string[] => {
  if (!facets || !facets[key]) {
    return [];
  }
  // Algolia returns facets as a map of { value: count }. We only need the keys (values).
  return Object.keys(facets[key]);
};

/**
 * Service for retrieving scoped catalog facets from Algolia.
 *
 * Pipeline context: This stage is executed at the beginning of the 'catalogTranslation'
 * phase. It captures the authoritative vocabulary currently available in the
 * learner's specific course catalog.
 *
 * These facets are used to ground the taxonomy-to-catalog translation process,
 * ensuring that we only search for courses using valid catalog terms.
 * This prevents the AI from suggesting skills or subjects that return zero results.
 */
export const catalogFacetService = {
  /**
   * Fetches the authoritative vocabulary currently available in the learner's course catalog
   * by issuing a zero-hit Algolia search (`hitsPerPage: 0`) scoped to the enterprise's
   * catalog query UUIDs and content type.
   *
   * The resulting `CatalogFacetSnapshot` is the ground-truth dictionary used by
   * `catalogTranslationRules.translateTaxonomyToCatalog` to validate that any skill or
   * subject term actually exists in the learner's catalog before it becomes a facet filter.
   *
   * @param config Optional retrieval configuration; defaults to `MAX_VALUES_PER_FACET` for
   *   the `maxValuesPerFacet` Algolia parameter.
   * @param context Enterprise catalog context containing search catalog UUIDs and their
   *   corresponding catalog query UUID mappings for scoping the facet call.
   * @returns A promise resolving to `{ snapshot, trace }` — the facet vocabulary and
   *   a count summary for debug visibility in the DebugConsole.
   */
  async getFacetSnapshot(
    config: FacetRetrievalConfig = {},
    context?: FacetBootstrapContext,
    index?: SearchIndex,
  ): Promise<{ snapshot: CatalogFacetSnapshot; trace: FacetSnapshotTrace }> {
    const { maxValuesPerFacet = MAX_VALUES_PER_FACET } = config;
    const resolvedIndex = index ?? (() => {
      const appConfig = getConfig();
      const searchClient: SearchClient = algoliasearch(
        appConfig.ALGOLIA_APP_ID,
        appConfig.ALGOLIA_SEARCH_API_KEY,
      );
      return searchClient.initIndex(appConfig.ALGOLIA_INDEX_NAME);
    })();

    // Build facetFilters to scope the snapshot to the enterprise catalog.
    // content_type:course scopes to courses; catalog query UUIDs restrict to the enterprise catalog.
    const facetFilters: string[][] = [[CONTENT_TYPE_COURSE]];

    if (context?.searchCatalogs?.length && context?.catalogUuidsToCatalogQueryUuids) {
      const queryUuids = context.searchCatalogs
        .map(cat => context.catalogUuidsToCatalogQueryUuids![cat])
        .filter(Boolean);
      if (queryUuids.length) {
        facetFilters.push(queryUuids.map(uuid => `${FACET_FIELDS.ENTERPRISE_CATALOG_QUERY_UUIDS}:${uuid}`));
      }
    }

    // Query Algolia for facets only (hitsPerPage: 0)
    // We use an empty query ('') to get the full universe of available values within the scope.
    const response = await resolvedIndex.search('', {
      facets: ['*'],
      hitsPerPage: 0,
      maxValuesPerFacet,
      facetFilters,
    });

    const { facets } = response;
    const snapshot: CatalogFacetSnapshot = {
      skill_names: safeReadFacet(facets, FACET_FIELDS.SKILL_NAMES),
      'skills.name': safeReadFacet(facets, FACET_FIELDS.SKILLS_DOT_NAME),
      subjects: safeReadFacet(facets, FACET_FIELDS.SUBJECTS),
      level_type: safeReadFacet(facets, FACET_FIELDS.LEVEL_TYPE),
      'partners.name': safeReadFacet(facets, FACET_FIELDS.PARTNERS_NAME),
    };

    const trace: FacetSnapshotTrace = {
      skillNamesCount: snapshot.skill_names.length,
      skillsDotNameCount: snapshot['skills.name'].length,
      subjectsCount: snapshot.subjects.length,
      levelTypeCount: snapshot.level_type.length,
      partnersNameCount: snapshot['partners.name'].length,
      sampleSkillNames: snapshot.skill_names.slice(0, 5),
      sampleSubjects: snapshot.subjects.slice(0, 5),
    };

    return { snapshot, trace };
  },
};
