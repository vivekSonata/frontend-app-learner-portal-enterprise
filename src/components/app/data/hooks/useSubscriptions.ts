import { querySubscriptions } from '../queries';
import useEnterpriseCustomer from './useEnterpriseCustomer';
import { useSuspenseBFF } from './useBFF';

interface SubscriptionsData {
  subscriptionLicenses: SubscriptionLicense[];
  customerAgreement: CustomerAgreement | null;
  subscriptionLicense?: SubscriptionLicense;
  subscriptionPlan?: SubscriptionLicense['subscriptionPlan'];
  subscriptionLicensesByStatus: Record<string, SubscriptionLicense[]>;
  licensesByCatalog: Record<string, SubscriptionLicense[]>;
  showExpirationNotifications: boolean;
}

type UseSubscriptionsQueryOptionsSelectFnArgs = {
  original: unknown;
  transformed: SubscriptionsData;
};

type UseSubscriptionsQueryOptions = {
  enabled?: boolean;
  select?: (data: UseSubscriptionsQueryOptionsSelectFnArgs) => unknown;
};

/**
 * Custom hook to get subscriptions data for the enterprise.
 * @returns The query results for the subscriptions.
 */
export default function useSubscriptions(queryOptions: UseSubscriptionsQueryOptions = {}) {
  const { data: enterpriseCustomer } = useEnterpriseCustomer<EnterpriseCustomer>();
  const { select } = queryOptions;

  return useSuspenseBFF({
    bffQueryOptions: {
      select: (data) => {
        const transformedData = data?.enterpriseCustomerUserSubsidies?.subscriptions;
        const multiLicenseFlag: boolean = Boolean(data?.enterpriseFeatures?.enableMultiLicenseEntitlementsBff);
        const normalizedData = (() => {
          if (!transformedData) { return transformedData; }

          // When the flag is ON, pass licensesByCatalog through for multi-license behaviour.
          // When the flag is OFF, strip licensesByCatalog so downstream consumers fall back
          // to the original single-license (master) behaviour.
          if (multiLicenseFlag) {
            return transformedData;
          }

          return {
            ...transformedData,
            licensesByCatalog: {},
            subscriptionLicenses: transformedData.subscriptionLicense
              ? [transformedData.subscriptionLicense]
              : [],
          };
        })();

        // When custom `select` function is provided in `queryOptions`, call it with original and transformed data.
        if (select) {
          return select({
            original: data,
            transformed: normalizedData,
          });
        }

        // Otherwise, return the transformed data.
        return normalizedData;
      },
    },
    fallbackQueryConfig: {
      ...querySubscriptions(enterpriseCustomer.uuid),
      select: (data: SubscriptionsData) => {
        const normalizedData = (() => {
          if (!data) { return data; }
          // The direct (non-BFF) API path never carries multi-license data,
          // so always use single-license (old master) behaviour.
          return {
            ...data,
            licensesByCatalog: {},
            subscriptionLicenses: data.subscriptionLicense
              ? [data.subscriptionLicense]
              : [],
          };
        })();

        if (select) {
          return select({
            original: data,
            transformed: normalizedData,
          });
        }
        return normalizedData;
      },
    },
  });
}
