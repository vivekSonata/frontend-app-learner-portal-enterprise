import {
  XpertIntent, LearnerLevel, TimeCommitment,
} from '../types';
import {
  DEFAULT_INTENT,
  LEARNER_LEVELS,
  TIME_COMMITMENTS,
} from '../constants';

/**
 * Expected shape of the AI response for course reasoning/enrichment.
 */
export interface ReasoningResponse {
  /** List of reasoning entries mapped by course ID. */
  reasonings: Array<{
    /** Unique course identifier. */
    id: string;
    /** Personalised reasoning for why this course belongs in the pathway. */
    reasoning: string;
  }>;
  /** Discovery data from Xpert RAG retrieval. */
  discovery?: any;
  /** Whether discovery RAG was used during the request. */
  wasDiscoveryUsed?: boolean;
}

const stripJsonFence = (raw: string): string => raw.replace(/```json\n?/, '').replace(/\n?```/, '').trim();

/**
 * Service for enforcing structural and semantic contracts for Xpert AI interactions.
 *
 * This service centralizes the logic for parsing raw AI strings, normalizing
 * inconsistent outputs (e.g., missing fields or invalid enums), and validating
 * the quality of the extracted intent against feature requirements.
 */
export const xpertContractService = {
  /**
   * Parses and normalizes a raw Xpert response string into a structured XpertIntent.
   * Handles common LLM output issues like markdown code fences.
   *
   * @param rawResponse The raw assistant message content from Xpert.
   * @returns A normalized XpertIntent object, or null if parsing fails.
   */
  parseIntent(rawResponse: string): XpertIntent | null {
    try {
      const jsonString = stripJsonFence(rawResponse);
      const parsed = JSON.parse(jsonString);
      return this.normalizeIntent(parsed);
    } catch {
      return null;
    }
  },

  /**
   * Coerces a raw object into a strictly-typed XpertIntent.
   * Ensures all required fields exist and enum values are valid, falling back to defaults if necessary.
   *
   * @param raw The unvalidated object from JSON.parse.
   * @returns A strict XpertIntent object.
   */
  normalizeIntent(raw: any): XpertIntent {
    /** Maps raw difficulty levels to valid LearnerLevel enums. */
    const normalizeLevel = (level: any): LearnerLevel => {
      const valid = LEARNER_LEVELS as unknown as any[];
      return valid.includes(level) ? level : DEFAULT_INTENT.learnerLevel;
    };

    /** Maps raw commitment options to valid TimeCommitment enums. */
    const normalizeCommitment = (commitment: any): TimeCommitment => {
      const valid = TIME_COMMITMENTS as unknown as any[];
      return valid.includes(commitment) ? commitment : DEFAULT_INTENT.timeCommitment;
    };

    /** Ensures a value is a valid array of strings. */
    const ensureArray = (val: any): string[] => (Array.isArray(val) ? val.filter(v => typeof v === 'string') : []);

    return {
      condensedQuery: (typeof raw.condensedQuery === 'string' && raw.condensedQuery.trim())
        ? raw.condensedQuery
        : DEFAULT_INTENT.condensedQuery,
      roles: ensureArray(raw.roles),
      skillsRequired: ensureArray(raw.skillsRequired),
      skillsPreferred: ensureArray(raw.skillsPreferred),
      industries: ensureArray(raw.industries),
      jobSources: ensureArray(raw.jobSources),
      learnerLevel: normalizeLevel(raw.learnerLevel),
      timeCommitment: normalizeCommitment(raw.timeCommitment),
      excludeTags: ensureArray(raw.excludeTags),
      discovery: raw.discovery || null,
      wasDiscoveryUsed: Boolean(raw.wasDiscoveryUsed),
    };
  },

  /**
   * Validates whether a normalized intent meets the quality standards for retrieval.
   *
   * @param intent The structured intent to validate.
   * @returns An object indicating validity and a list of specific errors.
   */
  validateIntent(intent: XpertIntent): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // condensedQuery is essential for Algolia retrieval.
    if (!intent.condensedQuery || intent.condensedQuery === DEFAULT_INTENT.condensedQuery || intent.condensedQuery.trim() === '') {
      errors.push('condensedQuery is empty');
    }

    // At least one role or skill must be present to drive a meaningful search.
    if (intent.roles.length === 0 && intent.skillsRequired.length === 0) {
      errors.push('Neither roles nor skillsRequired are present');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Parses and normalizes the AI response for pathway enrichment.
   *
   * @param rawResponse The raw JSON string from Xpert.
   * @returns A ReasoningResponse object, or null if parsing fails.
   */
  parseReasoning(rawResponse: string): ReasoningResponse | null {
    try {
      const jsonString = stripJsonFence(rawResponse);
      const parsed = JSON.parse(jsonString);

      if (!parsed.reasonings || !Array.isArray(parsed.reasonings)) {
        return null;
      }

      return {
        reasonings: parsed.reasonings.map((r: any) => ({
          id: String(r.id || ''),
          reasoning: String(r.reasoning || ''),
        })),
        discovery: parsed.discovery || null,
        wasDiscoveryUsed: Boolean(parsed.wasDiscoveryUsed),
      };
    } catch {
      return null;
    }
  },
};
