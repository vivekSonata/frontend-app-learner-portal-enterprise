/* eslint-disable react/jsx-filename-extension */
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { when } from 'jest-when';

import { renderWithRouterProvider } from '../../../utils/tests';
import { ensureAuthenticatedUser } from '../../app/routes/data';
import {
  extractEnterpriseCustomer,
  queryAcademiesDetail,
  queryBrowseAndRequestConfiguration,
  querySubscriptions,
} from '../../app/data';
import makeAcademiesLoader from './academyLoader';
import { authenticatedUserFactory, enterpriseCustomerFactory } from '../../app/data/services/data/__factories__';
import { SUBSIDY_TYPE } from '../../../constants';

jest.mock('../../app/routes/data', () => ({
  ...jest.requireActual('../../app/routes/data'),
  ensureAuthenticatedUser: jest.fn(),
}));

jest.mock('../../app/data', () => ({
  ...jest.requireActual('../../app/data'),
  extractEnterpriseCustomer: jest.fn(),
  updateUserActiveEnterprise: jest.fn(),
}));

const mockAuthenticatedUser = authenticatedUserFactory();
const mockEnterpriseCustomer = enterpriseCustomerFactory({ enable_academies: true });
const mockEnterpriseSlug = mockEnterpriseCustomer.slug;
const mockEnterpriseId = mockEnterpriseCustomer.uuid;
const mockAcademyUUID = 'test-academy-uuid';
const mockAcademiesURL = `/${mockEnterpriseSlug}/academies/${mockAcademyUUID}/`;
const mockSubscriptions = {
  subscriptionLicense: {
    status: 'activated',
    subscriptionPlan: {
      isCurrent: true,
    },
  },
};
const mockBrowseAndRequestConfiguration = {
  subsidyRequestsEnabled: true,
  subsidyType: SUBSIDY_TYPE.LICENSE,
};

const mockQueryClient = {
  ensureQueryData: jest.fn().mockResolvedValue({}),
  getQueryData: jest.fn(),
};

describe('academiesLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureAuthenticatedUser.mockResolvedValue(mockAuthenticatedUser);
    extractEnterpriseCustomer.mockResolvedValue(mockEnterpriseCustomer);

    const subscriptionsQuery = querySubscriptions(mockEnterpriseId);
    when(mockQueryClient.ensureQueryData)
      .calledWith(expect.objectContaining({ queryKey: subscriptionsQuery.queryKey }))
      .mockResolvedValue(mockSubscriptions);

    const browseAndRequestConfigurationQuery = queryBrowseAndRequestConfiguration(mockEnterpriseId);
    when(mockQueryClient.ensureQueryData)
      .calledWith(expect.objectContaining({ queryKey: browseAndRequestConfigurationQuery.queryKey }))
      .mockResolvedValue(mockBrowseAndRequestConfiguration);

    const academyDetailsQuery = queryAcademiesDetail(mockAcademyUUID, mockEnterpriseId);
    when(mockQueryClient.ensureQueryData)
      .calledWith(expect.objectContaining({ queryKey: academyDetailsQuery.queryKey }))
      .mockResolvedValue({});

    mockQueryClient.getQueryData.mockImplementation((queryKey) => {
      if (JSON.stringify(queryKey) === JSON.stringify(subscriptionsQuery.queryKey)) {
        return mockSubscriptions;
      }
      if (JSON.stringify(queryKey) === JSON.stringify(browseAndRequestConfigurationQuery.queryKey)) {
        return mockBrowseAndRequestConfiguration;
      }
      return undefined;
    });
  });

  it('does nothing with unauthenticated users', async () => {
    ensureAuthenticatedUser.mockResolvedValue(null);
    renderWithRouterProvider(
      {
        path: '/:enterpriseSlug/academies/:academyUUID/',
        element: <div>hello world</div>,
        loader: makeAcademiesLoader(mockQueryClient),
      },
      {
        initialEntries: [mockAcademiesURL],
      },
    );

    expect(await screen.findByText('hello world')).toBeInTheDocument();

    expect(mockQueryClient.ensureQueryData).not.toHaveBeenCalled();
  });

  it('ensures the requisite academies data is resolved', async () => {
    renderWithRouterProvider(
      {
        path: '/:enterpriseSlug/academies/:academyUUID/',
        element: <div>hello world</div>,
        loader: makeAcademiesLoader(mockQueryClient),
      },
      {
        initialEntries: [mockAcademiesURL],
      },
    );

    expect(await screen.findByText('hello world')).toBeInTheDocument();

    expect(mockQueryClient.ensureQueryData).toHaveBeenCalledTimes(4);
    expect(mockQueryClient.ensureQueryData).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryAcademiesDetail(mockAcademyUUID, mockEnterpriseId).queryKey,
        queryFn: expect.any(Function),
      }),
    );
  });

  it('redirects to search when enterprise does not have academies enabled', async () => {
    extractEnterpriseCustomer.mockResolvedValue(enterpriseCustomerFactory({ enable_academies: false }));

    renderWithRouterProvider(
      {
        path: '/:enterpriseSlug/academies/:academyUUID/',
        element: <div data-testid="academy-details" />,
        loader: makeAcademiesLoader(mockQueryClient),
      },
      {
        routes: [{
          path: '/:enterpriseSlug/search',
          element: <div data-testid="search-page" />,
        }],
        initialEntries: [mockAcademiesURL],
      },
    );

    expect(await screen.findByTestId('search-page')).toBeInTheDocument();
  });

  it('redirects to search when learner is not subscription eligible', async () => {
    const subscriptionsQuery = querySubscriptions(mockEnterpriseId);
    const browseAndRequestConfigurationQuery = queryBrowseAndRequestConfiguration(mockEnterpriseId);
    mockQueryClient.getQueryData.mockImplementation((queryKey) => {
      if (JSON.stringify(queryKey) === JSON.stringify(subscriptionsQuery.queryKey)) {
        return { subscriptionLicense: null };
      }
      if (JSON.stringify(queryKey) === JSON.stringify(browseAndRequestConfigurationQuery.queryKey)) {
        return { subsidyRequestsEnabled: false, subsidyType: SUBSIDY_TYPE.LICENSE };
      }
      return undefined;
    });

    renderWithRouterProvider(
      {
        path: '/:enterpriseSlug/academies/:academyUUID/',
        element: <div data-testid="academy-details" />,
        loader: makeAcademiesLoader(mockQueryClient),
      },
      {
        routes: [{
          path: '/:enterpriseSlug/search',
          element: <div data-testid="search-page" />,
        }],
        initialEntries: [mockAcademiesURL],
      },
    );

    expect(await screen.findByTestId('search-page')).toBeInTheDocument();
  });
});
