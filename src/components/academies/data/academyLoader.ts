import {
  generatePath,
  LoaderFunctionArgs,
  Params,
  redirect,
} from 'react-router-dom';

import { ensureAuthenticatedUser } from '../../app/routes/data';
import {
  extractEnterpriseCustomer,
  queryAcademiesDetail,
  queryBrowseAndRequestConfiguration,
  querySubscriptions,
  safeEnsureQueryDataBrowseAndRequestConfiguration,
  safeEnsureQueryDataSubscriptions,
} from '../../app/data';
import { SUBSIDY_TYPE } from '../../../constants';
import { LICENSE_STATUS } from '../../enterprise-user-subsidy/data/constants';

type AcademyRouteParams<Key extends string = string> = Params<Key> & {
  readonly academyUUID: string;
  readonly enterpriseSlug: string;
};
interface AcademyLoaderFunctionArgs extends LoaderFunctionArgs {
  params: AcademyRouteParams;
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

const makeAcademiesLoader: MakeRouteLoaderFunctionWithQueryClient = function makeAcademiesLoader(queryClient) {
  return async function academiesLoader({ params, request }: AcademyLoaderFunctionArgs) {
    const requestUrl = new URL(request.url);
    const authenticatedUser = await ensureAuthenticatedUser(requestUrl, params);
    // User is not authenticated, so we can't do anything in this loader.
    if (!authenticatedUser) {
      return null;
    }

    const { academyUUID, enterpriseSlug } = params;
    const enterpriseCustomer = await extractEnterpriseCustomer({
      requestUrl,
      queryClient,
      authenticatedUser,
      enterpriseSlug,
    });
    if (!enterpriseCustomer) {
      return null;
    }

    await Promise.all([
      safeEnsureQueryDataSubscriptions({
        queryClient,
        enterpriseCustomer,
      }),
      safeEnsureQueryDataBrowseAndRequestConfiguration({
        queryClient,
        enterpriseCustomer,
      }),
    ]);

    const subscriptionsQuery = querySubscriptions(enterpriseCustomer.uuid);
    const browseAndRequestConfigurationQuery = queryBrowseAndRequestConfiguration(enterpriseCustomer.uuid);
    const subscriptionsData = queryClient.getQueryData<SubscriptionsData>(subscriptionsQuery.queryKey);
    const browseAndRequestConfiguration = queryClient.getQueryData<BrowseAndRequestConfiguration | null>(
      browseAndRequestConfigurationQuery.queryKey,
    );

    const hasActivatedCurrentLicense = subscriptionsData?.subscriptionLicense?.status === LICENSE_STATUS.ACTIVATED
      && subscriptionsData?.subscriptionLicense?.subscriptionPlan?.isCurrent;
    const hasRequestsEnabledForSubscriptions = browseAndRequestConfiguration?.subsidyRequestsEnabled
      && browseAndRequestConfiguration?.subsidyType === SUBSIDY_TYPE.LICENSE;
    const hasAcademiesAccess = enterpriseCustomer.enableAcademies
      && (hasActivatedCurrentLicense || hasRequestsEnabledForSubscriptions);

    if (!hasAcademiesAccess) {
      throw redirect(generatePath('/:enterpriseSlug/search', { enterpriseSlug }));
    }

    await queryClient.ensureQueryData(queryAcademiesDetail(academyUUID, enterpriseCustomer.uuid));

    return null;
  };
};

export default makeAcademiesLoader;
