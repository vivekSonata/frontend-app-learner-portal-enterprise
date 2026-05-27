import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { AIPathwaysTab } from '../AIPathwaysTab';

jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(() => ({ ALGOLIA_INDEX_NAME: 'test-index' })),
}));

jest.mock('../routes/AiPathwaysPage', () => ({
  AiPathwaysPage: () => <div data-testid="pathways-page">Pathways Page</div>,
}));

const customRender = (ui: React.ReactElement) => render(
  <IntlProvider locale="en">
    {ui}
  </IntlProvider>,
);

describe('AIPathwaysTab', () => {
  it('renders AiPathwaysPage', () => {
    customRender(<AIPathwaysTab />);
    expect(screen.getByTestId('pathways-page')).toBeInTheDocument();
  });
});
