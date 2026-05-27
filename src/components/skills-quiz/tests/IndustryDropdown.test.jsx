import '@testing-library/jest-dom/extend-expect';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { SearchContext } from '@2uinc/frontend-enterprise-catalog-search';

import { renderWithRouter } from '../../../utils/tests';
import IndustryDropdown from '../IndustryDropdown';
import industryMessages from '../industryMessages';

const defaultSearchContext = {
  refinements: {},
  dispatch: jest.fn(),
};

const esLabel = 'Industria a la que pertenezco';
const esPlaceholder = 'Buscar una industria...';
const esAriaLabel = 'Escriba para buscar una industria';

const esMessages = {
  [industryMessages.industryLabel.id]: esLabel,
  [industryMessages.industrySearchPlaceholder.id]: esPlaceholder,
  [industryMessages.industrySearchAriaLabel.id]: esAriaLabel,
};

const IndustryDropdownWrapper = ({ locale = 'en', messages }) => (
  <IntlProvider locale={locale} messages={messages}>
    <SearchContext.Provider value={defaultSearchContext}>
      <IndustryDropdown />
    </SearchContext.Provider>
  </IntlProvider>
);

describe('<IndustryDropdown />', () => {
  it('renders the English label by default', () => {
    renderWithRouter(<IndustryDropdownWrapper />, { route: '/test/skills-quiz/' });

    expect(screen.getByText(industryMessages.industryLabel.defaultMessage)).toBeInTheDocument();
  });

  it('renders the English search placeholder when the dropdown is opened', async () => {
    const user = userEvent.setup();
    renderWithRouter(<IndustryDropdownWrapper />, { route: '/test/skills-quiz/' });

    await user.click(screen.getByText(industryMessages.industryLabel.defaultMessage));

    expect(
      screen.getByPlaceholderText(industryMessages.industrySearchPlaceholder.defaultMessage),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(industryMessages.industrySearchAriaLabel.defaultMessage),
    ).toBeInTheDocument();
  });

  it('renders the localized label and placeholder when locale is Spanish', async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <IndustryDropdownWrapper locale="es-419" messages={esMessages} />,
      { route: '/test/skills-quiz/' },
    );

    expect(screen.getByText(esLabel)).toBeInTheDocument();

    await user.click(screen.getByText(esLabel));

    expect(screen.getByPlaceholderText(esPlaceholder)).toBeInTheDocument();
    expect(screen.getByLabelText(esAriaLabel)).toBeInTheDocument();
  });
});
