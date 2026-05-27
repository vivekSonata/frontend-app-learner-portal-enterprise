import React, { useMemo } from 'react';
import { Container } from '@openedx/paragon';
import { usePathways } from '../hooks/usePathways';
import { usePromptInterceptor } from '../hooks';
import { FEATURE_STEPS } from '../constants';
import {
  LoadingState,
  ErrorState,
  IntakeForm,
  UserProfile,
  PathwayList,
  DebugConsole,
  PromptEditorModal,
} from '../components';

/**
 * AiPathwaysPage is the top-level entry point and router for the AI Pathways feature.
 *
 * It manages the high-level UI state and coordinates the transitions between
 * the different functional stages:
 * 1. Intake: Collecting learner goals and background.
 * 2. Profile: Displaying AI-matched careers and refining preferences.
 * 3. Results: Presenting the final personalized learning pathway.
 *
 * It also hosts the Debug Console and Prompt Interceptor layer when the
 * '?debug=true' query parameter is present.
 */
export const AiPathwaysPage = () => {
  const {
    currentStep,
    learnerProfile,
    selectedCareer,
    pathway,
    pathwayResponse,
    isLoading,
    error,
    generateProfile,
    selectCareer,
    generatePathway,
    setCurrentStep,
  } = usePathways();

  const isDebug = useMemo(() => {
    if (typeof window === 'undefined') { return false; }
    return new URLSearchParams(window.location.search).get('debug') === 'true';
  }, []);

  // Instantiate the interceptor only when debug mode is active.
  // When isDebug is false the hook is still called (Rules of Hooks) but
  // interceptPrompt will never be passed to generateProfile, so the
  // interception layer is fully bypassed at runtime.
  const {
    interceptPrompt,
    pendingInterception,
    accept,
    reject,
    cancel,
  } = usePromptInterceptor();

  const renderContent = useMemo(() => {
    switch (currentStep) {
      case FEATURE_STEPS.INTAKE:
        return (
          <IntakeForm
            onSubmit={async (args) => {
              await generateProfile(args, isDebug ? interceptPrompt : undefined);
            }}
            isSubmitting={isLoading}
          />
        );
      case FEATURE_STEPS.PROFILE:
        if (isLoading && !learnerProfile) { return <LoadingState />; }
        if (error && !learnerProfile) { return <ErrorState message={error.message} />; }
        if (!learnerProfile && !isLoading) { return <ErrorState message="No profile found" />; }
        return (
          <UserProfile
            profile={learnerProfile!}
            selectedCareer={selectedCareer}
            onSelectCareer={selectCareer}
            onBuildPathway={generatePathway}
            isGenerating={isLoading}
            error={error}
            onUpdateProfile={async (updates) => {
              const args = {
                bringsYouHereRes: updates.motivation ?? learnerProfile!.motivation,
                careerGoalRes: updates.careerGoal ?? learnerProfile!.careerGoal,
                learningPrefRes: learnerProfile!.learningStyle,
                backgroundRes: updates.background ?? learnerProfile!.background,
                industryRes: updates.targetIndustry ?? learnerProfile!.targetIndustry,
                timeAvailableRes: learnerProfile!.timeAvailable,
                certificateRes: learnerProfile!.certificate,
              };
              await generateProfile(args, isDebug ? interceptPrompt : undefined);
            }}
          />
        );
      case FEATURE_STEPS.PATHWAY:
        if (isLoading) { return <LoadingState />; }
        if (error) { return <ErrorState message={error.message} />; }
        if (!pathway) { return <ErrorState message="No pathway data available" />; }
        return (
          <PathwayList
            pathway={pathway}
            onAdjustPathway={() => setCurrentStep(FEATURE_STEPS.INTAKE)}
          />
        );
      default:
        return <div>Not Found</div>;
    }
  }, [
    currentStep,
    learnerProfile,
    pathway,
    selectedCareer,
    isLoading,
    error,
    generateProfile,
    selectCareer,
    generatePathway,
    setCurrentStep,
    isDebug,
    interceptPrompt,
  ]);

  return (
    <Container className="ai-pathways-page pb-5">
      <div className="py-4">
        <header className="mb-4">
          <h2 className="h3 font-weight-bold">AI Learning Pathways</h2>
          <p className="text-muted">A personalized prototype for AI-generated learning roadmaps.</p>
        </header>
        <main>
          {isDebug && (
            <DebugConsole
              response={pathwayResponse}
            />
          )}
          {isDebug && (
            <PromptEditorModal
              bundle={pendingInterception?.bundle ?? null}
              context={pendingInterception?.context ?? null}
              onAccept={accept}
              onReject={reject}
              onCancel={cancel}
            />
          )}
          {renderContent}
        </main>
      </div>
    </Container>
  );
};
