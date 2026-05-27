import { CreateLearnerProfileArgs } from '../types';

/**
 * Represents the cleaned and structured user data ready for the AI Intent Extraction stage.
 */
export interface PreprocessedInput {
  /** Cleaned primary narrative from the user (e.g., "What brings you here"). */
  freeText: string;
  /** Extracted objectives from "Career Goal" and "Industry" fields. */
  selectedGoals?: string[];
  /** Experience context from "Background" and "Skills" fields. */
  knownContext?: string[];
  /** Modality and commitment preferences (e.g., "async", "long-term"). */
  preferences?: string[];
}

/**
 * Utility for normalizing raw intake form responses.
 *
 * Pipeline context: This is the very first stage of the generation process. It
 * transforms raw UI strings into a compact, noise-free structure that reduces
 * token usage and improves intent extraction accuracy in later AI stages.
 */
export const intakePreprocessor = {
  /**
   * Transforms raw intake form responses into a compact, noise-free `PreprocessedInput`
   * ready for the Xpert intent-extraction prompt.
   *
   * Stripping filler phrases and normalising time-availability tokens reduces prompt
   * token count and removes ambiguity that could degrade AI extraction quality.
   *
   * @param args The raw field values submitted by the learner through the intake form UI.
   * @returns A `PreprocessedInput` with cleaned free-text, extracted goals, known context,
   *   and normalised preferences — all ready to be serialised into the system prompt.
   */
  preprocessInput(args: CreateLearnerProfileArgs): PreprocessedInput {
    /**
     * Strips common conversational filler phrases and trims surrounding whitespace
     * to isolate the learner's core intent statement.
     *
     * @param text Raw free-text field value from the intake form.
     * @returns The cleaned text with leading filler phrases removed.
     */
    const cleanText = (text: string) => (
      text || ''
    )
      .trim()
      .replace(/^I want to learn |Please show me |Could you help me with /gi, '');

    /**
     * Converts human-readable time-availability labels (e.g. "Up to 3 hrs/week")
     * to the normalised token keys (`'short' | 'medium' | 'long'`) expected by the
     * Xpert prompt schema.
     *
     * @param time The raw time-availability string from the intake form.
     * @returns A normalised token, or the lowercased raw value if no mapping matches.
     */
    const mapTime = (time: string) => {
      const t = (time || '').toLowerCase();
      if (t.includes('up to 3') || t.includes('short')) { return 'short'; }
      if (t.includes('4-6') || t.includes('medium')) { return 'medium'; }
      if (t.includes('7 or more') || t.includes('long')) { return 'long'; }
      return t;
    };

    return {
      freeText: cleanText(args.bringsYouHereRes),
      selectedGoals: [args.careerGoalRes, args.industryRes].filter(Boolean),
      knownContext: [args.backgroundRes].filter(Boolean),
      preferences: [
        args.learningPrefRes,
        mapTime(args.timeAvailableRes),
        args.certificateRes,
      ].filter(Boolean),
    };
  },
};
