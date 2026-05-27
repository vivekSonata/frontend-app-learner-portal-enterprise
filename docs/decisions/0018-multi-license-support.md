# ADR 0018: Multi-License Support

## Status

Accepted

## Context

A learner can have **multiple active subscription licenses**, each tied to a **different catalog** of courses. For example:

```
Learner Alice has 3 licenses:
├── License A → Catalog 1 (Leadership courses)     expires Jun 2026
├── License B → Catalog 2 (Technical courses)       expires Sep 2026
└── License C → Catalog 3 (Compliance courses)      expires Mar 2027
```

Previously, the frontend picked **one license globally** (the first activated one) and used it everywhere. If Alice viewed a Technical course (Catalog 2) but the code picked License C (Catalog 3), the system reported "no applicable license" — even though License B was valid for that course.

## Decision

We updated the frontend to evaluate **all eligible licenses** and select the correct one based on the course being viewed. Rollout is controlled by the the `enterpriseFeatures.enableMultiLicenseEntitlementsBff` capability returned by the BFF, so multi-license behavior is enabled only when the enableMultiLicenseEntitlementsBff flag is on by the backend signals support..

## Overall Flow

```
┌─────────────────────────────────────────────────────────────┐
│  BFF Response (from backend)                                │
│                                                             │
│  subscription_licenses: [License A, B, C]                   │
│  licenses_by_catalog: {                                     │
│    "catalog-1": [License A],                                │
│    "catalog-2": [License B],                                │
│    "catalog-3": [License C]                                 │
│  }                                                          │
│  subscription_license: License A  (legacy single pick)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Data Layer                                        │
│                                                             │
│  transformSubscriptionsData()                               │
│    - Legacy path keeps licensesByCatalog empty              │
│    - Still picks single subscriptionLicense (backward compat)│
│                                                             │
│  All hooks read from TanStack Query cache                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌──────────┐  ┌───────────┐  ┌──────────────┐
      │ Dashboard │  │  Search   │  │ Course Page  │
      │           │  │           │  │              │
      │ Uses all  │  │ Adds ALL  │  │ Picks the    │
      │ licenses  │  │ catalog   │  │ RIGHT license│
      │ for       │  │ UUIDs to  │  │ for THIS     │
      │ upgrade   │  │ Algolia   │  │ course's     │
      │ URLs      │  │ filters   │  │ catalog      │
      └──────────┘  └───────────┘  └──────────────┘
```

## Feature Flag

The feature is controlled by `enterpriseFeatures.enableMultiLicenseEntitlementsBff`, a **backend waffle flag** returned in the BFF response under `enterprise_features.enable_multi_license_entitlements_bff`. There is **no frontend env var or URL parameter** for this flag.

```
enableMultiLicenseEntitlementsBff = false (default)
  → useSubscriptions() strips licensesByCatalog to {}
  → All code paths use the OLD single-license behavior
  → Zero behavioral change from master

enableMultiLicenseEntitlementsBff = true
  → useSubscriptions() passes licensesByCatalog through
  → resolveApplicableSubscriptionLicense() checks ALL licenses
  → getSearchCatalogs() includes ALL activated license catalogs
  → Course page picks the license whose catalog contains the course
```

### How it works

The flag is read in `src/components/app/data/hooks/useSubscriptions.ts`:

```typescript
const multiLicenseFlag = data?.enterpriseFeatures?.enableMultiLicenseEntitlementsBff;
```

When `false`, `useSubscriptions()` strips `licensesByCatalog` to `{}` and reduces `subscriptionLicenses` to a single-element array — exactly matching old master behavior. When `true`, it passes the full `licensesByCatalog` and `subscriptionLicenses` from the BFF response through to downstream consumers.

### How to Enable

**In Django admin** — enable the waffle flag `enable_multi_license_entitlements_bff` in the enterprise-access service. The BFF will then include `enable_multi_license_entitlements_bff: true` in its `enterprise_features` response.

**For testing** — the backend must return the flag as `true` in the BFF response. There is no frontend-only override.

## Files Changed

### Data Layer — Store `licensesByCatalog` (3 files)

| File | Purpose |
|------|---------|
| `src/components/app/data/constants.js` | Adds `licensesByCatalog: {}` to `baseSubscriptionsData` shape |
| `src/components/app/data/services/bffs.ts` | Adds `licensesByCatalog: {}` to BFF response base shape so `camelCaseObject()` maps `licenses_by_catalog` from the API |
| `src/types/enterprise-access.openapi.d.ts` | Adds `licenses_by_catalog` TypeScript type to `Subscriptions` schema |

### Transform — Legacy path keeps single-license behavior (1 file)

| File | Purpose |
|------|---------|
| `src/components/app/data/services/subsidies/subscriptions.js` | `transformSubscriptionsData()` sets `licensesByCatalog` to `{}` on the legacy (direct API) path. Multi-license selection is only supported on the BFF path, where the backend provides a pre-built `licenses_by_catalog` mapping. The legacy API does not return this field, so the legacy path intentionally stays single-license. |

```javascript
// Legacy path: no multi-license index built
subscriptionsData.licensesByCatalog = {};

// BFF path: licenses_by_catalog comes from the backend response
// and is auto-mapped via camelCaseObject() to licensesByCatalog
```

### Core Selection Logic (1 file)

| File | Purpose |
|------|---------|
| `src/components/app/data/utils.js` | Three changes described below |

**`resolveApplicableSubscriptionLicense()`** — New function that replaces the old single-license check:

```
enableMultiLicenseEntitlementsBff OFF (licensesByCatalog is empty):
  → Falls back to determineSubscriptionLicenseApplicable(subscriptionLicense, catalogsWithCourse)
  → Returns subscriptionLicense or null (identical to master)

enableMultiLicenseEntitlementsBff ON (licensesByCatalog is populated):
  → Gets all activated current licenses from subscriptionLicenses
  → Checks licensesByCatalog to find licenses matching catalogsWithCourse
  → Picks the one expiring latest (tie-breaking rule)
  → Returns that license or null
```

**`getSearchCatalogs()` updated** — Now accepts `licensesByCatalog`:

```
enableMultiLicenseEntitlementsBff OFF (licensesByCatalog is empty):
  → Adds single subscriptionLicense's catalog (identical to master)

enableMultiLicenseEntitlementsBff ON (licensesByCatalog is populated):
  → Adds ALL catalog UUIDs from licensesByCatalog
  → Learner sees courses from ALL their licensed catalogs in search
```

**`getSubscriptionDisabledEnrollmentReasonType()` fixed** — When `resolveApplicableSubscriptionLicense()` returns null, the code now correctly determines WHY (expired vs revoked vs not assigned) by checking the raw license data directly.

### Search — Include all catalogs (1 file)

| File | Purpose |
|------|---------|
| `src/components/app/data/hooks/useSearchCatalogs.js` | Passes `licensesByCatalog` to `getSearchCatalogs()` so Algolia filters include ALL licensed catalogs |

**Before**: Learner with 3 licenses only saw courses from 1 catalog in search.
**After**: Learner sees courses from all 3 catalogs.

### UI Gating — Check any license (1 file)

| File | Purpose |
|------|---------|
| `src/components/app/data/hooks/useHasValidLicenseOrSubscriptionRequestsEnabled.js` | When `enableMultiLicenseEntitlementsBff` is ON and `licensesByCatalog` is populated, checks if ANY license exists (instead of checking the single `subscriptionLicense`). Gates video catalog visibility and search page access. |

### Course-Level License Selection (4 files)

These are the core consumers that pick the right license for a specific course:

| File | What it does |
|------|-------------|
| `src/components/course/data/hooks/useUserSubsidyApplicableToCourse.js` | Calls `resolveApplicableSubscriptionLicense()` to find the license matching this course's catalog, passes it to `getSubsidyToApplyForCourse()` |
| `src/components/app/data/hooks/useCourseRedemptionEligibility.ts` | Same pattern — determines if a subscription license takes priority over learner credit for this specific course |
| `src/components/course/data/courseLoader.ts` | Route loader that prefetches course data — uses `resolveApplicableSubscriptionLicense()` to check license applicability during data loading |
| `src/components/course/routes/externalCourseEnrollmentLoader.ts` | Executive education enrollment loader — same pattern for exec-ed courses |

### Dashboard Upgrade (1 file)

| File | Purpose |
|------|---------|
| `src/components/dashboard/main-content/course-enrollments/data/hooks.js` | `useCourseUpgradeData()` — When building the enrollment URL for course upgrades, finds the correct license for that specific course's catalog instead of always using the single global license |

## Concrete Example

```
Alice has 3 activated licenses:
  License 807a65cd → Catalog 11111111 (Leadership)  expires Jun 25
  License 807bba77 → Catalog 22222222 (Technical)   expires Sep 23
  License 807bbd3e → Catalog 33333333 (Compliance)  expires Mar 27
```

| Scenario | Old Behavior | New Behavior (flag ON) |
|----------|-------------|----------------------|
| Alice views a Technical course (catalog 22222222) | Uses License 807bbd3e (Compliance) → **wrong catalog → "no subsidy"** | Uses License 807bba77 (Technical) → **correct → can enroll** |
| Alice searches for courses | Only sees Compliance catalog courses | Sees courses from **all 3 catalogs** |
| Alice views a course in catalog 44444444 (no license) | No subsidy shown | No subsidy shown (correct) |
| `enableMultiLicenseEntitlementsBff` is OFF | Uses License 807bbd3e for everything | Uses License 807bbd3e for everything (same as master) |

## Test Coverage

| Test File | What's Covered |
|-----------|---------------|
| `subscriptions.test.js` | `licensesByCatalog` built correctly in `transformSubscriptionsData()` |
| `utils.test.js` | `resolveApplicableSubscriptionLicense()`: flag ON/OFF, single/multi catalog, overlapping, revoked, empty inputs, expired/deactivated reason detection |
| `useSearchCatalogs.test.jsx` | `licensesByCatalog` passed to `getSearchCatalogs()` |
| `useHasValidLicenseOrSubscriptionRequestsEnabled.test.jsx` | Multi-license flag ON checks any active license |
| `useCourseRedemptionEligibility.test.jsx` | Correct license selected for course context |
| `courseLoader.test.jsx` | Route loader uses `resolveApplicableSubscriptionLicense()` |
| `externalCourseEnrollmentLoader.test.jsx` | Exec-ed loader uses correct license |
| `hooks.test.jsx` (dashboard) | Upgrade URL uses course-specific license |
| `rootLoader.test.jsx` | `licensesByCatalog: {}` in transformed data shape |

## Consequences

- Learners with multiple licenses see the correct entitlement for each course
- Search results include courses from all licensed catalogs
- Legacy single-license users experience zero behavioral change
- The feature is controlled entirely by the backend waffle flag `enable_multi_license_entitlements_bff` — no frontend env var needed
- When the flag is OFF, `useSubscriptions()` strips `licensesByCatalog` to `{}` so downstream consumers fall back to single-license behavior
- Tie-breaking rule (latest expiration) provides consistent, learner-favorable license selection
