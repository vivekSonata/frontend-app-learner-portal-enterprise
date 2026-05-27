import { useContext } from 'react';
import { SearchContext } from '@2uinc/frontend-enterprise-catalog-search';
import FacetListRefinement from '@2uinc/frontend-enterprise-catalog-search/FacetListRefinement';
import PropTypes from 'prop-types';

import { useIntl } from '@edx/frontend-platform/i18n';
import { INDUSTRY_ATTRIBUTE_NAME, INDUSTRY_FACET } from './constants';
import industryMessages from './industryMessages';

const IndustryDropdown = ({ isStyleAutoSuggest, isStyleSearchBox }) => {
  const intl = useIntl();
  const { refinements } = useContext(SearchContext);
  const { attribute, facetValueType, typeaheadOptions } = INDUSTRY_FACET;

  const label = intl.formatMessage(industryMessages.industryLabel);
  const localizedTypeaheadOptions = {
    ...typeaheadOptions,
    placeholder: intl.formatMessage(industryMessages.industrySearchPlaceholder),
    ariaLabel: intl.formatMessage(industryMessages.industrySearchAriaLabel),
  };

  return (
    <FacetListRefinement
      key={attribute}
      title={
        refinements[INDUSTRY_ATTRIBUTE_NAME]?.length > 0
          ? refinements[INDUSTRY_ATTRIBUTE_NAME][0]
          : label
      }
      label={label}
      attribute={attribute}
      defaultRefinement={refinements[INDUSTRY_ATTRIBUTE_NAME]}
      limit={300} // this is replicating the B2C search experience
      refinements={refinements}
      facetValueType={facetValueType}
      typeaheadOptions={localizedTypeaheadOptions}
      searchable={!!typeaheadOptions}
      showBadge={false}
      isStyleAutoSuggest={isStyleAutoSuggest}
      isStyleSearchBox={isStyleSearchBox}
    />
  );
};

IndustryDropdown.propTypes = {
  isStyleAutoSuggest: PropTypes.bool,
  isStyleSearchBox: PropTypes.bool,
};

IndustryDropdown.defaultProps = {
  isStyleAutoSuggest: false,
  isStyleSearchBox: false,
};

export default IndustryDropdown;
