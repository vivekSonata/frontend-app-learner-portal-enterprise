import { useState, useCallback, useMemo } from 'react';
import type { CreateLearnerProfileArgs } from '../types';
import { INTAKE_PAGES, INTAKE_STEPS } from '../constants';

interface UseIntakeFormArgs {
  onSubmit: (data: CreateLearnerProfileArgs) => Promise<void>;
}

/**
 * Hook to manage the state and multi-step navigation logic of the AI Pathways intake form.
 *
 * It handles:
 * - Tracking the current form page index.
 * - Managing raw form response data.
 * - Calculating progress percentage.
 * - Navigating between steps (Back/Next).
 * - Triggering the final submission to the generation pipeline.
 *
 * @param onSubmit Callback to execute when the form is submitted.
 * @returns An object containing form state and interaction handlers.
 */
export const useIntakeForm = ({ onSubmit }: UseIntakeFormArgs) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [formData, setFormData] = useState<CreateLearnerProfileArgs>({
    bringsYouHereRes: '',
    careerGoalRes: '',
    backgroundRes: '',
    industryRes: '',
    learningPrefRes: 'async',
    timeAvailableRes: '',
    certificateRes: '',
  });

  const progress = useMemo(() => (pageIndex / (INTAKE_PAGES.length - 1)) * 100, [pageIndex]);

  /** Updates a single field in `formData` without affecting other fields. */
  const handleChange = useCallback((field: keyof CreateLearnerProfileArgs, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Advances the form to the next page, or submits when the final preferences page
   * is reached (transitions to the processing/loading step before calling `onSubmit`).
   */
  const handleNext = useCallback(async () => {
    if (pageIndex === INTAKE_STEPS.PREFERENCES) {
      setPageIndex(INTAKE_STEPS.PROCESSING);
      await onSubmit(formData);
    } else {
      setPageIndex(pageIndex + 1);
    }
  }, [pageIndex, formData, onSubmit]);

  /** Returns to the previous page if the form is not already on the first step. */
  const handleBack = useCallback(() => {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
  }, [pageIndex]);

  const currentPage = INTAKE_PAGES[pageIndex];

  return {
    pageIndex,
    formData,
    progress,
    currentPage,
    handleChange,
    handleNext,
    handleBack,
    setPageIndex,
  };
};
