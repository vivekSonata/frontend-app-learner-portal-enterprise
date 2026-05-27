import {
  useState, useCallback, useMemo, useRef, useContext,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '@edx/frontend-platform';
import { AppContext } from '@edx/frontend-platform/react';
import { intentExtractionXpertService, PromptInterceptFn } from '../services/intentExtraction.xpert.service';
import { pathwayAssemblerXpertService } from '../services/pathwayAssembler.xpert.service';
import { careerRetrievalService } from '../services/careerRetrieval';
import { courseRetrievalService } from '../services/courseRetrieval';
import { intakePreprocessor } from '../services/intakePreprocessor';

import useAlgoliaSearch from '../../app/data/hooks/useAlgoliaSearch';
import useEnterpriseCustomer from '../../app/data/hooks/useEnterpriseCustomer';
import useSearchCatalogs from '../../app/data/hooks/useSearchCatalogs';
import { getSupportedLocale } from '../../app/data/utils';

import {
  LearningPathway,
  CareerOption,
  LearnerProfile,
  CreateLearnerProfileArgs,
  XpertIntent,
  CareerCardModel,
  AIPathwaysResponseModel,
  PromptDebugEntry,
  CourseRetrievalHit,
} from '../types';
import { catalogFacetService } from '../services/catalogFacetService';
import { catalogTranslationRules } from '../services/catalogTranslationRules';
import { catalogTranslationService } from '../services/catalogTranslationService';
import { mergeTags, mergeDiscovery } from '../utils/discoveryUtils';
import { FEATURE_STEPS, COURSE_STATUSES } from '../constants';
import { DEFAULT_XPERT_RAG_TAGS } from '../constants/retrieval.constants';
import useCatalogAlgoliaSearch from './useCatalogAlgoliaSearch';

/**
 * Union type representing the possible steps in the AI Pathways generation flow.
 */
export type PathwayStep = typeof FEATURE_STEPS[keyof typeof FEATURE_STEPS];

/**
 * Creates a wrapped interceptPrompt function that records the interaction outcome
 * into a debug log. This allows the DebugConsole to surface prompt history.
 *
 * @param interceptPrompt The original prompt interceptor function.
 * @param debugLog The mutable array to store the capture entries.
 * @returns A wrapped PromptInterceptFn.
 */
function makeCapturingInterceptor(
  interceptPrompt: PromptInterceptFn,
  debugLog: PromptDebugEntry[],
): PromptInterceptFn {
  return async (bundle, context) => {
    const result = await interceptPrompt(bundle, context);
    const entry: PromptDebugEntry = {
      label: context.label,
      original: bundle,
      decision: result.decision,
      timestamp: new Date().toISOString(),
    };
    // Attach the edited bundle only if the user modified it before accepting.
    if (result.decision === 'accepted' && result.bundle && result.bundle !== bundle) {
      entry.edited = result.bundle;
    }
    // Surface any validation issues produced by the validator.
    if (result.validationWarnings && result.validationWarnings.length > 0) {
      entry.validationWarnings = result.validationWarnings;
    }
    debugLog.push(entry);
    return result;
  };
}

/**
 * Central orchestrator hook for the AI Learning Pathways feature.
 *
 * This hook manages the end-to-end state and lifecycle of a personalized pathway
 * generation request. It coordinates multiple asynchronous AI and search services,
 * providing a unified interface for the UI.
 *
 * Pipeline Flow:
 * 1. Intake: User submits form → generateProfile()
 * 2. Intent Extraction: AI processes narrative into structured intent.
 * 3. Career Discovery: Search taxonomy for matching professional roles.
 * 4. Selection: User chooses a target career → selectCareer()
 * 5. Translation: Taxonomy terms mapped deterministically to catalog facets.
 * 6. Course Discovery: Progressive search "ladder" to find courses → generatePathway()
 * 7. Enrichment: AI generates personalized reasoning for recommendations.
 * 8. UI Rendering: Final pathway displayed to learner.
 *
 * @returns An object containing the current pipeline state and action handlers.
 */
export const usePathways = () => {
  const [currentStep, setCurrentStep] = useState<PathwayStep>(FEATURE_STEPS.INTAKE);
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(null);
  const [searchIntent, setSearchIntent] = useState<XpertIntent | null>(null);
  const [selectedCareer, setSelectedCareer] = useState<CareerCardModel | null>(null);
  const [pathway, setPathway] = useState<LearningPathway | null>(null);
  const [pathwayResponse, setPathwayResponse] = useState<AIPathwaysResponseModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Optional interceptor supplied during the 'generateProfile' call.
   * Stored in a ref to persist across multiple pipeline actions.
   */
  const interceptPromptRef = useRef<PromptInterceptFn | undefined>(undefined);

  /**
   * Cumulative debug log for the current request.
   */
  const promptDebugLogRef = useRef<PromptDebugEntry[]>([]);

  // External context for Algolia and API calls
  const config = getConfig();
  const { authenticatedUser }: AppContextValue = useContext(AppContext);

  /**
   * Algolia index for professional roles and taxonomy skills.
   */
  const {
    searchIndex: jobIndex,
  } = useAlgoliaSearch(config.ALGOLIA_INDEX_NAME_JOBS);

  /**
   * Algolia index for the actual course catalog.
   */
  const {
    searchIndex: catalogIndex,
    catalogUuidsToCatalogQueryUuids,
    shouldUseSecuredAlgoliaApiKey,
  } = useAlgoliaSearch(config.ALGOLIA_INDEX_NAME);

  const { searchIndex: catalogAlgoliaSearchIndex } = useCatalogAlgoliaSearch();

  const currentCatalogIndex = catalogAlgoliaSearchIndex ?? catalogIndex;

  const enterpriseCustomerResult = useEnterpriseCustomer();
  const enterpriseCustomer = (enterpriseCustomerResult.data || {}) as { uuid?: string, slug?: string };
  const searchCatalogs = useSearchCatalogs();

  const facetContext = useMemo(() => ({
    enterpriseCustomerUuid: enterpriseCustomer.uuid,
    searchCatalogs,
    catalogUuidsToCatalogQueryUuids,
    locale: getSupportedLocale(),
    shouldUseSecuredAlgoliaApiKey,
  }), [
    enterpriseCustomer.uuid,
    searchCatalogs,
    catalogUuidsToCatalogQueryUuids,
    shouldUseSecuredAlgoliaApiKey,
  ]);

  /**
   * Starts the generation process from the raw intake form data.
   * Executes Preprocessing, Intent Extraction, and Career Discovery.
   *
   * @param args Raw form responses from the learner.
   * @param interceptPrompt Optional hook for reviewing prompts in debug mode.
   * @returns The generated LearnerProfile containing suggested career paths.
   */
  const generateProfile = useCallback(async (
    args: CreateLearnerProfileArgs,
    interceptPrompt?: PromptInterceptFn,
  ) => {
    interceptPromptRef.current = interceptPrompt;
    promptDebugLogRef.current = [];
    if (!jobIndex) {
      throw new Error('Search index not initialized');
    }

    const requestId = uuidv4();
    const responseModel: AIPathwaysResponseModel = {
      requestId,
      tags: DEFAULT_XPERT_RAG_TAGS,
      stages: {} as any,
    };

    setIsLoading(true);
    setError(null);
    try {
      // 1. Preprocess Input (Clean narrative and normalize choices)
      const preprocessed = intakePreprocessor.preprocessInput(args);
      // 2. Intent Extraction (AI stage)
      responseModel.promptDebug = promptDebugLogRef.current;
      const profileInterceptor = interceptPromptRef.current
        ? makeCapturingInterceptor(interceptPromptRef.current, promptDebugLogRef.current)
        : undefined;

      const extractionResult = await intentExtractionXpertService.extractIntent(
        preprocessed,
        profileInterceptor,
        DEFAULT_XPERT_RAG_TAGS,
      );
      responseModel.stages.intentExtraction = extractionResult.debug;
      // Sync the top-level tags and discovery with what was actually used
      responseModel.tags = mergeTags(responseModel.tags, extractionResult.debug.tags);
      responseModel.discovery = mergeDiscovery(responseModel.discovery, extractionResult.debug.discovery);
      responseModel.wasDiscoveryUsed = responseModel.wasDiscoveryUsed || extractionResult.debug.wasDiscoveryUsed;

      const { intent } = extractionResult;
      setSearchIntent(intent);

      // 4. Career Retrieval (Deterministic search based on intent)
      const careerStartTime = Date.now();
      const { careers, trace: careerTrace } = await careerRetrievalService.searchCareers(jobIndex, intent);
      responseModel.stages.careerRetrieval = {
        durationMs: Date.now() - careerStartTime,
        success: true,
        resultCount: careers.length,
        trace: careerTrace,
      };

      // 5. Build the UI-facing profile summary
      const overview = careers.length > 0
        ? `Found ${careers.length} career matches for your goals.`
        : `We couldn't find exact matches for "${intent.condensedQuery}", but here are some recommended career paths.`;

      const profile: LearnerProfile = {
        name: authenticatedUser?.name || authenticatedUser?.username,
        overview,
        careerGoal: args.careerGoalRes,
        targetIndustry: args.industryRes,
        background: args.backgroundRes,
        motivation: args.bringsYouHereRes,
        learningStyle: args.learningPrefRes,
        timeAvailable: args.timeAvailableRes,
        certificate: args.certificateRes,
        careerMatches: careers.map(c => ({
          title: c.title,
          percentMatch: 0.95, // Default similarity placeholder
          skills: c.skills,
          industries: c.industries,
        })),
      };

      // Persist original careers for the selection phase.
      (profile as any).rawCareers = careers;

      setPathwayResponse(responseModel);
      setLearnerProfile(profile);

      // Auto-select the first match as the default.
      if (careers.length > 0) {
        setSelectedCareer(careers[0]);
      }
      setCurrentStep(FEATURE_STEPS.PROFILE);
      return profile;
    } catch (err) {
      const errorInstance = err instanceof Error ? err : new Error('Failed to generate profile');
      setError(errorInstance);
      throw errorInstance;
    } finally {
      setIsLoading(false);
    }
  }, [jobIndex, authenticatedUser?.name, authenticatedUser?.username]);

  /**
   * Selects a career option from the match list.
   *
   * @param career The career option chosen by the user.
   */
  const selectCareer = useCallback((career: CareerOption) => {
    const fullCareer = (learnerProfile as any)?.rawCareers?.find((c: CareerCardModel) => c.title === career.title);
    setSelectedCareer(fullCareer || null);
  }, [learnerProfile]);

  /**
   * Finalizes the pathway by discovering courses and generating reasoning.
   * Executes Translation (Rules/AI), Discovery (Ladder), and Enrichment stages.
   *
   * @returns The list of discovered courses.
   */
  const generatePathway = useCallback(async () => {
    if (!selectedCareer || !searchIntent || !currentCatalogIndex || !pathwayResponse) {
      throw new Error('Missing data or search index to generate pathway');
    }

    setIsLoading(true);
    setError(null);
    const updatedResponseModel = { ...pathwayResponse };
    const pathwayInterceptor = interceptPromptRef.current
      ? makeCapturingInterceptor(interceptPromptRef.current, promptDebugLogRef.current)
      : undefined;

    try {
      const courseStartTime = Date.now();

      // 1. Catalog Facet Snapshot (Grounds skill mapping to this enterprise's catalog)
      const facetStartMs = Date.now();
      const { snapshot: facetSnapshot, trace: facetSnapshotTrace } = await catalogFacetService
        .getFacetSnapshot({}, facetContext, currentCatalogIndex);
      updatedResponseModel.stages.catalogFacetSnapshot = {
        durationMs: Date.now() - facetStartMs,
        success: true,
        trace: facetSnapshotTrace,
      };

      // 2. Rules-first Mapping (Deterministic: selectedCareer.skills → catalog facets)
      const rulesFirstMs = Date.now();
      const { result: rulesFirst, trace: rulesFirstTrace } = catalogTranslationRules.translateTaxonomyToCatalog({
        careerTitle: selectedCareer.title,
        skills: selectedCareer.skills || [],
        skillDetails: (selectedCareer.raw?.skills || []) as import('../types').TaxonomySkill[],
        intentRequiredSkills: searchIntent?.skillsRequired || [],
        intentPreferredSkills: searchIntent?.skillsPreferred || [],
        learnerLevel: searchIntent?.learnerLevel,
        industries: selectedCareer.industries || [],
        similarJobs: selectedCareer.similarJobs || [],
        facetSnapshot,
      });
      updatedResponseModel.stages.rulesFirstMapping = {
        durationMs: Date.now() - rulesFirstMs,
        success: true,
        trace: rulesFirstTrace,
      };

      // 3. Translation Consolidation (No AI — produces facet-first or text-fallback intent)
      const translationMs = Date.now();
      const { translation, trace: translationTrace } = catalogTranslationService.processTranslation(
        selectedCareer.title,
        rulesFirst,
        { learnerLevel: searchIntent?.learnerLevel, intentRequiredSkills: searchIntent?.skillsRequired },
      );
      updatedResponseModel.stages.catalogTranslation = {
        durationMs: Date.now() - translationMs,
        success: true,
        trace: translationTrace,
      };

      // 4. Course Retrieval (Progressive Discovery stage)
      const { courses, ladderTrace } = await courseRetrievalService.fetchCourses(
        translation,
        currentCatalogIndex,
      );
      updatedResponseModel.stages.retrievalLadder = {
        durationMs: 0,
        success: true,
        trace: ladderTrace,
      };
      const winningAttempt = ladderTrace.attempts?.find((a) => a.winner);
      updatedResponseModel.stages.courseRetrieval = {
        durationMs: Date.now() - courseStartTime,
        success: true,
        resultCount: courses.length,
        hits: courses.map((c) => c.raw as CourseRetrievalHit),
        winnerStep: ladderTrace.winnerStep,
        selectedCourseIds: courses.map((c) => c.id),
        selectedCourseTitles: courses.map((c) => c.title),
        requestSummary: {
          winningQuery: winningAttempt?.query,
          winningFacetFilters: winningAttempt?.facetFilters,
          winningOptionalFilters: winningAttempt?.optionalFilters,
        },
      };
      // 6. Assembly (Map to LearningPathway shape)
      const initialPathway: LearningPathway = {
        courses: courses.map(c => ({
          id: c.id,
          title: c.title,
          level: c.level || '',
          skills: c.skills,
          status: COURSE_STATUSES.NOT_STARTED,
          order: c.order,
          shortDescription: c.shortDescription || '',
          imageUrl: c.imageUrl || '',
          marketingUrl: c.marketingUrl || '',
        })),
      };

      // 7. Enrichment (AI stage for personalized reasoning)
      const enrichmentResult = await pathwayAssemblerXpertService.enrichWithReasoning(
        initialPathway,
        searchIntent,
        pathwayInterceptor,
        updatedResponseModel.tags || DEFAULT_XPERT_RAG_TAGS,
      );
      updatedResponseModel.stages.pathwayEnrichment = enrichmentResult.debug;
      // Sync tags and discovery after enrichment (final stage)
      updatedResponseModel.tags = mergeTags(updatedResponseModel.tags, enrichmentResult.debug.tags);
      updatedResponseModel.discovery = mergeDiscovery(
        updatedResponseModel.discovery,
        enrichmentResult.debug.discovery,
      );
      updatedResponseModel.wasDiscoveryUsed = updatedResponseModel.wasDiscoveryUsed
        || enrichmentResult.debug.wasDiscoveryUsed;

      setPathway(enrichmentResult.pathway);
      setPathwayResponse(updatedResponseModel);
      setCurrentStep(FEATURE_STEPS.PATHWAY);
      return courses;
    } catch (err) {
      const errorInstance = err instanceof Error ? err : new Error('Failed to generate pathway');
      setError(errorInstance);
      throw errorInstance;
    } finally {
      setIsLoading(false);
    }
  }, [selectedCareer, searchIntent, currentCatalogIndex, pathwayResponse, facetContext]);

  /**
   * Resets the entire feature state, returning the user to the intake form.
   */
  const reset = useCallback(() => {
    setCurrentStep(FEATURE_STEPS.INTAKE);
    setLearnerProfile(null);
    setSearchIntent(null);
    setSelectedCareer(null);
    setPathway(null);
    setError(null);
  }, []);

  return {
    currentStep,
    learnerProfile,
    searchIntent,
    selectedCareer,
    pathway,
    pathwayResponse,
    isLoading,
    error,
    generateProfile,
    selectCareer,
    generatePathway,
    setCurrentStep,
    reset,
  };
};
