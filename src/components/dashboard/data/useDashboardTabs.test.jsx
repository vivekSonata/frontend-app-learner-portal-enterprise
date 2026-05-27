import { renderHook } from '@testing-library/react';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { AppContext } from '@edx/frontend-platform/react';
import { QueryClientProvider } from '@tanstack/react-query';

import useDashboardTabs from './useDashboardTabs';
import { features } from '../../../config';
import {
  useEnterpriseCustomer,
  useEnterpriseFeatures,
  useEnterprisePathwaysList,
  useEnterpriseProgramsList,
} from '../../app/data';
import { queryClient } from '../../../utils/tests';
import {
  authenticatedUserFactory,
  enterpriseCustomerFactory,
} from '../../app/data/services/data/__factories__';
import {
  DASHBOARD_AI_PATHWAYS_TAB,
  DASHBOARD_COURSES_TAB,
  DASHBOARD_MY_CAREER_TAB,
  DASHBOARD_PATHWAYS_TAB,
  DASHBOARD_PROGRAMS_TAB,
} from './constants';

jest.mock('../../app/data', () => ({
  ...jest.requireActual('../../app/data'),
  useEnterpriseCustomer: jest.fn(),
  useEnterpriseFeatures: jest.fn(),
  useEnterprisePathwaysList: jest.fn(),
  useEnterpriseProgramsList: jest.fn(),
}));

jest.mock('../../../config', () => ({
  features: {
    FEATURE_ENABLE_AI_LEARNER_PATHWAYS: false,
    FEATURE_ENABLE_MY_CAREER: false,
  },
}));

jest.mock('@2uinc/frontend-enterprise-utils', () => ({
  ...jest.requireActual('@2uinc/frontend-enterprise-utils'),
  sendEnterpriseTrackEvent: jest.fn(),
}));

jest.mock('../../my-career/data/utils', () => ({
  extractCurrentJobID: jest.fn().mockReturnValue(null),
}));

jest.mock('@loadable/component', () => jest.fn(() => ({ preload: jest.fn() })));

const mockEnterpriseCustomer = enterpriseCustomerFactory();
const mockAuthenticatedUser = authenticatedUserFactory();

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient()}>
    <IntlProvider locale="en">
      <AppContext.Provider value={{ authenticatedUser: mockAuthenticatedUser }}>
        {children}
      </AppContext.Provider>
    </IntlProvider>
  </QueryClientProvider>
);

describe('useDashboardTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEnterpriseCustomer.mockReturnValue({ data: mockEnterpriseCustomer });
    useEnterpriseFeatures.mockReturnValue({ data: {} });
    useEnterpriseProgramsList.mockReturnValue({ data: [] });
    useEnterprisePathwaysList.mockReturnValue({ data: [] });
    features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS = false;
    features.FEATURE_ENABLE_MY_CAREER = false;
  });

  it('always returns courses tab', () => {
    const { result } = renderHook(() => useDashboardTabs(), { wrapper });
    const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
    expect(tabKeys).toContain(DASHBOARD_COURSES_TAB);
  });

  it('returns expected hook shape', () => {
    const { result } = renderHook(() => useDashboardTabs(), { wrapper });
    expect(result.current).toMatchObject({
      tabs: expect.any(Array),
      onSelectHandler: expect.any(Function),
      activeTab: DASHBOARD_COURSES_TAB,
      prefetchTabs: expect.any(Function),
    });
  });

  describe('programs tab', () => {
    it('is shown when enterprise customer has programs enabled', () => {
      const enterpriseCustomerWithPrograms = enterpriseCustomerFactory({ enable_programs: true });
      useEnterpriseCustomer.mockReturnValue({ data: enterpriseCustomerWithPrograms });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).toContain(DASHBOARD_PROGRAMS_TAB);
    });

    it('is not shown when enterprise customer has programs disabled', () => {
      const enterpriseCustomerWithoutPrograms = enterpriseCustomerFactory({ enable_programs: false });
      useEnterpriseCustomer.mockReturnValue({ data: enterpriseCustomerWithoutPrograms });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_PROGRAMS_TAB);
    });
  });

  describe('pathways tab', () => {
    it('is shown when enterprise customer has pathways enabled', () => {
      const enterpriseCustomerWithPathways = enterpriseCustomerFactory({ enable_pathways: true });
      useEnterpriseCustomer.mockReturnValue({ data: enterpriseCustomerWithPathways });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).toContain(DASHBOARD_PATHWAYS_TAB);
    });

    it('is not shown when enterprise customer has pathways disabled', () => {
      const enterpriseCustomerWithoutPathways = enterpriseCustomerFactory({ enable_pathways: false });
      useEnterpriseCustomer.mockReturnValue({ data: enterpriseCustomerWithoutPathways });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_PATHWAYS_TAB);
    });
  });

  describe('My Career tab', () => {
    it('is shown when FEATURE_ENABLE_MY_CAREER is enabled', () => {
      features.FEATURE_ENABLE_MY_CAREER = true;
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).toContain(DASHBOARD_MY_CAREER_TAB);
    });

    it('is not shown when FEATURE_ENABLE_MY_CAREER is disabled', () => {
      features.FEATURE_ENABLE_MY_CAREER = false;
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_MY_CAREER_TAB);
    });
  });

  describe('AI Pathways tab (enterpriseAiPathwaysOperatorEnabled)', () => {
    it('is shown when both FEATURE_ENABLE_AI_LEARNER_PATHWAYS and enterpriseAiPathwaysOperatorEnabled are enabled', () => {
      features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS = true;
      useEnterpriseFeatures.mockReturnValue({ data: { enterpriseAiPathwaysOperatorEnabled: true } });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).toContain(DASHBOARD_AI_PATHWAYS_TAB);
    });

    it('is not shown when FEATURE_ENABLE_AI_LEARNER_PATHWAYS is disabled and enterpriseAiPathwaysOperatorEnabled is enabled', () => {
      features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS = false;
      useEnterpriseFeatures.mockReturnValue({ data: { enterpriseAiPathwaysOperatorEnabled: true } });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_AI_PATHWAYS_TAB);
    });

    it('is not shown when FEATURE_ENABLE_AI_LEARNER_PATHWAYS is enabled and enterpriseAiPathwaysOperatorEnabled is disabled', () => {
      features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS = true;
      useEnterpriseFeatures.mockReturnValue({ data: { enterpriseAiPathwaysOperatorEnabled: false } });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_AI_PATHWAYS_TAB);
    });

    it('is not shown when both FEATURE_ENABLE_AI_LEARNER_PATHWAYS and enterpriseAiPathwaysOperatorEnabled are disabled', () => {
      features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS = false;
      useEnterpriseFeatures.mockReturnValue({ data: { enterpriseAiPathwaysOperatorEnabled: false } });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_AI_PATHWAYS_TAB);
    });

    it('is not shown when enterpriseAiPathwaysOperatorEnabled is absent from enterprise features', () => {
      features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS = true;
      useEnterpriseFeatures.mockReturnValue({ data: {} });
      const { result } = renderHook(() => useDashboardTabs(), { wrapper });
      const tabKeys = result.current.tabs.map(tab => tab.props.eventKey);
      expect(tabKeys).not.toContain(DASHBOARD_AI_PATHWAYS_TAB);
    });
  });
});
