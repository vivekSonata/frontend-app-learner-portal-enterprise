import { renderWithRouter } from '@2uinc/frontend-enterprise-utils';

import { SearchData } from '@2uinc/frontend-enterprise-catalog-search';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { SkillsContextProvider } from '../SkillsContextProvider';

export const renderWithSearchContext = (children) => renderWithRouter(
  <IntlProvider locale="en">
    <SearchData>
      <SkillsContextProvider>
        {children}
      </SkillsContextProvider>
    </SearchData>
  </IntlProvider>,
);
