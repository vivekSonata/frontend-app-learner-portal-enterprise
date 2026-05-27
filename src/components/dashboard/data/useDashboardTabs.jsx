import {
  useCallback, useContext, useEffect, useState,
} from 'react';
import loadable from '@loadable/component';
import { useQueryClient } from '@tanstack/react-query';
import { Tab } from '@openedx/paragon';
import { sendEnterpriseTrackEvent } from '@2uinc/frontend-enterprise-utils';
import { useIntl } from '@edx/frontend-platform/i18n';
import { AppContext } from '@edx/frontend-platform/react';

import CoursesTabComponent from '../main-content/CoursesTabComponent';
import { ProgramListingPage } from '../../program-progress';
import PathwayProgressListingPage from '../../pathway-progress/PathwayProgressListingPage';
import { features } from '../../../config';
import {
  DASHBOARD_AI_PATHWAYS_TAB,
  DASHBOARD_COURSES_TAB,
  DASHBOARD_MY_CAREER_TAB,
  DASHBOARD_PATHWAYS_TAB,
  DASHBOARD_PROGRAMS_TAB,
  DASHBOARD_TABS_SEGMENT_KEY,
} from './constants';
import MyCareerTabSkeleton from '../../my-career/MyCareerTabSkeleton';
import {
  queryLearnerSkillLevels,
  useEnterpriseCustomer,
  useEnterpriseFeatures,
  useEnterprisePathwaysList,
  useEnterpriseProgramsList,
} from '../../app/data';
import { extractCurrentJobID } from '../../my-career/data/utils';

const MyCareerTab = loadable(() => import(
  '../../my-career/MyCareerTab'
), {
  fallback: <MyCareerTabSkeleton />,
});

const AIPathwaysTab = loadable(() => import(
  '../../ai-pathways/AIPathwaysTab'
), {
  fallback: <div>Loading AI Pathways...</div>,
});

const useDashboardTabs = () => {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const { authenticatedUser } = useContext(AppContext);
  const { data: enterpriseCustomer } = useEnterpriseCustomer();
  const [activeTab, setActiveTab] = useState(DASHBOARD_COURSES_TAB);
  const { data: enterprisePrograms } = useEnterpriseProgramsList();
  const { data: enterprisePathways } = useEnterprisePathwaysList();
  const { data: enterpriseFeatures } = useEnterpriseFeatures();

  // TODO: Remove or pare down to a single feature flag from enterpriseFeatures (waffle)
  //      when ai-pathways POC is no longer needed
  const enableAIPathways = features.FEATURE_ENABLE_AI_LEARNER_PATHWAYS
    && enterpriseFeatures?.enterpriseAiPathwaysOperatorEnabled;
  const learnerCurrentJobID = extractCurrentJobID(authenticatedUser);

  // Creates prefetch logic based on loadable-components, "component splitting" capability expose to Tabs component
  const prefetchTabs = useCallback(() => {
    if (features.FEATURE_ENABLE_MY_CAREER) {
      // Preload/prefetch "My Career" tab.
      MyCareerTab.preload();
      if (learnerCurrentJobID) {
        queryClient.prefetchQuery(queryLearnerSkillLevels(learnerCurrentJobID));
      }
    }
  }, [learnerCurrentJobID, queryClient]);

  useEffect(() => {
    prefetchTabs();
  }, [prefetchTabs]);

  const onSelectHandler = (tabName) => {
    setActiveTab(tabName);
    sendEnterpriseTrackEvent(
      enterpriseCustomer.uuid,
      `edx.ui.enterprise.learner_portal.${DASHBOARD_TABS_SEGMENT_KEY[tabName]}.page_visit`,
    );
  };

  // Defines the tab components and rendered child, and filters based on active features
  const allTabs = [
    <Tab
      eventKey={DASHBOARD_COURSES_TAB}
      title={intl.formatMessage({
        id: 'enterprise.dashboard.tab.courses',
        defaultMessage: 'Courses',
        description: 'Title for courses tab on enterprise dashboard.',
      })}
    >
      {activeTab === DASHBOARD_COURSES_TAB && <CoursesTabComponent />}
    </Tab>,
    enterpriseCustomer.enablePrograms && (
      <Tab
        eventKey={DASHBOARD_PROGRAMS_TAB}
        title={intl.formatMessage({
          id: 'enterprise.dashboard.tab.programs',
          defaultMessage: 'Programs',
          description: 'Title for programs tab on enterprise dashboard.',
        })}
        disabled={enterprisePrograms.length === 0}
      >
        {activeTab === DASHBOARD_PROGRAMS_TAB && <ProgramListingPage />}
      </Tab>
    ),
    enterpriseCustomer.enablePathways && (
      <Tab
        eventKey={DASHBOARD_PATHWAYS_TAB}
        title={intl.formatMessage({
          id: 'enterprise.dashboard.tab.pathways',
          defaultMessage: 'Pathways',
          description: 'Title for pathways tab on enterprise dashboard.',
        })}
        disabled={enterprisePathways.length === 0}
      >
        {activeTab === DASHBOARD_PATHWAYS_TAB && <PathwayProgressListingPage />}
      </Tab>
    ),
    features.FEATURE_ENABLE_MY_CAREER && (
      <Tab
        eventKey={DASHBOARD_MY_CAREER_TAB}
        title={intl.formatMessage({
          id: 'enterprise.dashboard.tab.my.career',
          defaultMessage: 'My Career',
          description: 'Title for my career tab on enterprise dashboard.',
        })}
      >
        {activeTab === DASHBOARD_MY_CAREER_TAB && <MyCareerTab learnerCurrentJobID={learnerCurrentJobID} />}
      </Tab>
    ),
    enableAIPathways && (
      <Tab
        eventKey={DASHBOARD_AI_PATHWAYS_TAB}
        title={intl.formatMessage({
          id: 'enterprise.dashboard.tab.ai.pathways',
          defaultMessage: 'AI Pathways',
          description: 'Title for AI pathways tab on enterprise dashboard.',
        })}
      >
        {activeTab === DASHBOARD_AI_PATHWAYS_TAB && <AIPathwaysTab />}
      </Tab>
    ),
  ].filter(tab => tab); // Filtering for truthy values

  return {
    tabs: allTabs,
    onSelectHandler,
    activeTab,
    prefetchTabs,
  };
};

export default useDashboardTabs;
