import { defineMessages } from '@edx/frontend-platform/i18n';
import { getSearchFacetFilters as getBaseSearchFacetFilters } from '@2uinc/frontend-enterprise-catalog-search';
import { features } from '../../config';

export function isShortCourse(course) {
  return course.course_length === 'short';
}

const messages = defineMessages({
  programsTitle: {
    id: 'search.facetFilters.programs.title',
    defaultMessage: 'Program',
    description: 'Title for the programs facet filter',
  },
  programsTypeaheadPlaceholder: {
    id: 'search.facetFilters.programs.typeahead.placeholder',
    defaultMessage: 'Find a program...',
    description: 'Placeholder for the programs typeahead input',
  },
  programsTypeaheadAriaLabel: {
    id: 'search.facetFilters.programs.typeahead.aria.label',
    defaultMessage: 'Type to find a program',
    description: 'Aria label for the programs typeahead input',
  },
  newContentTitle: {
    id: 'search.facetFilters.newContent.title',
    defaultMessage: 'Recently added',
    description: 'Title for the new content (recently added) facet filter',
  },
});

export function getSearchFacetFilters(intl) {
  const searchFilters = getBaseSearchFacetFilters(intl);

  const OVERRIDE_FACET_FILTERS = [];
  if (features.PROGRAM_TYPE_FACET) {
    const PROGRAM_TYPE_FACET_OVERRIDE = {
      overrideSearchKey: 'title',
      overrideSearchValue: intl.formatMessage(messages.programsTitle),
      updatedFacetFilterValue: {
        attribute: 'program_type',
        title: intl.formatMessage(messages.programsTitle),
        isSortedAlphabetical: true,
        typeaheadOptions: {
          placeholder: intl.formatMessage(messages.programsTypeaheadPlaceholder),
          ariaLabel: intl.formatMessage(messages.programsTypeaheadAriaLabel),
          minLength: 3,
        },
      },
    };
    OVERRIDE_FACET_FILTERS.push(PROGRAM_TYPE_FACET_OVERRIDE);
  }

  OVERRIDE_FACET_FILTERS.forEach(({ overrideSearchKey, overrideSearchValue, updatedFacetFilterValue }) => {
    searchFilters.find((facetFilter, index) => {
      if (facetFilter[overrideSearchKey] === overrideSearchValue) {
        searchFilters[index] = updatedFacetFilterValue;
        return true;
      }
      return false;
    });
  });

  if (features.NEW_CONTENT_FACET) {
    searchFilters.push({
      attribute: 'is_new_content',
      title: intl.formatMessage(messages.newContentTitle),
      isEndOfRow: true,
    });
  }

  return searchFilters;
}
