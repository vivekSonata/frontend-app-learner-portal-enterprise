import { SUBSIDY_TYPE } from '../../../../constants';
import { LICENSE_STATUS } from '../../../enterprise-user-subsidy/data/constants';
import { useBrowseAndRequestConfiguration } from './useBrowseAndRequest';
import useSubscriptions from './useSubscriptions';
import { features } from '../../../../config';

export default function useHasValidLicenseOrSubscriptionRequestsEnabled() {
  const { data: { subscriptionLicense, licensesByCatalog } } = useSubscriptions();
  const { data: browseAndRequestConfiguration } = useBrowseAndRequestConfiguration();

  let hasActivatedAndCurrentLicense;
  if (features.MULTI_LICENSE_SUPPORT && licensesByCatalog) {
    hasActivatedAndCurrentLicense = Object.values(licensesByCatalog).flat().length > 0;
  } else {
    hasActivatedAndCurrentLicense = subscriptionLicense?.status === LICENSE_STATUS.ACTIVATED
      && subscriptionLicense?.subscriptionPlan?.isCurrent;
  }

  const hasRequestsEnabledForSubscriptions = browseAndRequestConfiguration?.subsidyRequestsEnabled
  && browseAndRequestConfiguration.subsidyType === SUBSIDY_TYPE.LICENSE;
  return hasActivatedAndCurrentLicense || hasRequestsEnabledForSubscriptions;
}
