import {
  generatePath, LoaderFunctionArgs, Params, redirect,
} from 'react-router-dom';
import { getConfig } from '@edx/frontend-platform/config';
import { ensureAuthenticatedUser } from '../../app/routes/data/utils';
import {
  extractEnterpriseCustomer,
  queryBrowseAndRequestConfiguration,
  queryAcademiesList,
  querySubscriptions,
  safeEnsureQueryDataBrowseAndRequestConfiguration,
  safeEnsureQueryDataAcademiesList,
  safeEnsureQueryDataContentHighlightSets,
  safeEnsureQueryDataSubscriptions,
} from '../../app/data';
import { SUBSIDY_TYPE } from '../../../constants';
import { LICENSE_STATUS } from '../../enterprise-user-subsidy/data/constants';

type SearchRouteParams<Key extends string = string> = Params<Key> & {
  readonly enterpriseSlug: string;
};
interface SearchLoaderFunctionArgs extends LoaderFunctionArgs {
  params: SearchRouteParams;
}
interface Academy {
  uuid: string;
}
interface SubscriptionPlan {
  isCurrent?: boolean;
}
interface SubscriptionLicense {
  status?: string;
  subscriptionPlan?: SubscriptionPlan;
}
interface SubscriptionsData {
  subscriptionLicense?: SubscriptionLicense;
}
interface BrowseAndRequestConfiguration {
  subsidyRequestsEnabled?: boolean;
  subsidyType?: string;
}

const makeSearchLoader: MakeRouteLoaderFunctionWithQueryClient = function makeSearchLoader(queryClient) {
  return async function searchLoader({ params, request } : SearchLoaderFunctionArgs) {
    const requestUrl = new URL(request.url);
    const authenticatedUser = await ensureAuthenticatedUser(requestUrl, params);

    // User is not authenticated, so we can't do anything in this loader.
    if (!authenticatedUser) {
      return null;
    }

    const { enterpriseSlug } = params;

    const enterpriseCustomer = await extractEnterpriseCustomer({
      requestUrl,
      queryClient,
      authenticatedUser,
      enterpriseSlug,
    });
    if (!enterpriseCustomer) {
      return null;
    }

    const searchData = [
      safeEnsureQueryDataAcademiesList({
        queryClient,
        enterpriseCustomer,
      }),
      safeEnsureQueryDataSubscriptions({
        queryClient,
        enterpriseCustomer,
      }),
      safeEnsureQueryDataBrowseAndRequestConfiguration({
        queryClient,
        enterpriseCustomer,
      }),
    ];
    if (getConfig().FEATURE_CONTENT_HIGHLIGHTS) {
      searchData.push(
        safeEnsureQueryDataContentHighlightSets({
          queryClient,
          enterpriseCustomer,
        }),
      );
    }

    await Promise.all(searchData);

    const academiesListQuery = queryAcademiesList(enterpriseCustomer.uuid);
    const subscriptionsQuery = querySubscriptions(enterpriseCustomer.uuid);
    const browseAndRequestConfigurationQuery = queryBrowseAndRequestConfiguration(enterpriseCustomer.uuid);
    const academies = queryClient.getQueryData<Academy[]>(academiesListQuery.queryKey);
    const subscriptionsData = queryClient
      .getQueryData<SubscriptionsData>(subscriptionsQuery.queryKey);
    const browseAndRequestConfiguration = queryClient.getQueryData<BrowseAndRequestConfiguration | null>(
      browseAndRequestConfigurationQuery.queryKey,
    );

    const hasActivatedCurrentLicense = subscriptionsData?.subscriptionLicense?.status === LICENSE_STATUS.ACTIVATED
      && subscriptionsData?.subscriptionLicense?.subscriptionPlan?.isCurrent;
    const hasRequestsEnabledForSubscriptions = browseAndRequestConfiguration?.subsidyRequestsEnabled
      && browseAndRequestConfiguration?.subsidyType === SUBSIDY_TYPE.LICENSE;
    const hasAcademiesAccess = enterpriseCustomer.enableAcademies
      && (hasActivatedCurrentLicense || hasRequestsEnabledForSubscriptions);

    if (enterpriseCustomer.enableOneAcademy && hasAcademiesAccess && academies?.length === 1) {
      const redirectPath = generatePath('/:enterpriseSlug/academies/:academyUUID', {
        enterpriseSlug,
        academyUUID: academies[0].uuid,
      });
      return redirect(redirectPath);
    }

    return null;
  };
};

export default makeSearchLoader;
