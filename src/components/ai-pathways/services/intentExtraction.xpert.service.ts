import { intakePreprocessor, PreprocessedInput } from './intakePreprocessor';
import { xpertService } from './xpert.service';
import { xpertContractService } from './xpertContract';
import {
  XpertPromptBundle, PromptPart, XpertMessage,
} from '../types';
import { XpertExtractionResult } from './xpertDebug';
import { InterceptContext, InterceptResult } from '../hooks/usePromptInterceptor';
import { DEFAULT_INTENT, INTENT_EXTRACTION_PROMPT } from '../constants';

/**
 * Type definition for the prompt interception function.
 * Allows the UI (DebugConsole) to inspect and modify prompts before they are sent to Xpert.
 */
export type PromptInterceptFn = (
  bundle: XpertPromptBundle,
  context: InterceptContext,
) => Promise<InterceptResult>;

/**
 * Service for extracting structured user intent using the Xpert AI API.
 *
 * Pipeline context: This is the second stage of the generation process. It takes the
 * preprocessed user input and translates it into a structured `XpertIntent` object.
 * This intent then drives the Career Retrieval stage.
 */
export const intentExtractionXpertService = {
  /**
   * Converts preprocessed intake form data into a structured `XpertIntent` by calling
   * the Xpert AI platform with a curated system prompt and optional RAG tag scoping.
   *
   * The call flow:
   * 1. Builds the system prompt from the Discovery RAG base.
   * 2. Passes the prompt through the optional `interceptPrompt` hook so the DebugConsole
   *    can inspect or modify it before the network call.
   * 3. Sends the prompt to Xpert and parses the response via `xpertContractService.parseIntent`.
   * 4. If parsing fails, triggers an automatic repair prompt to recover from common LLM output issues.
   *
   * @param input The cleaned user narrative and preferences from `intakePreprocessor.preprocessInput`.
   * @param interceptPrompt Optional hook for prompt inspection/modification in debug mode.
   * @param tags Optional RAG control tags that scope Xpert's document retrieval to a relevant
   *   knowledge base subset.
   * @returns A promise resolving to an `XpertExtractionResult` with the normalized intent
   *   and full execution debug metadata (prompts, raw response, duration, validation errors).
   * @throws Error if the user cancels generation during prompt interception.
   */
  async extractIntent(
    input: PreprocessedInput,
    interceptPrompt?: PromptInterceptFn,
    tags?: string[],
  ): Promise<XpertExtractionResult> {
    const startTime = Date.now();
    const originalBundle = this.buildSystemPrompt();
    originalBundle.tags = tags;

    // --- Interception Logic ---
    let activeBundle = originalBundle;
    if (interceptPrompt) {
      const userMessages: XpertMessage[] = [{ role: 'user', content: JSON.stringify(input) }];
      const context: InterceptContext = {
        label: 'Intent Extraction',
        messages: userMessages,
        meta: { stage: 'intentExtraction' },
      };
      const result = await interceptPrompt(originalBundle, context);
      if (result.decision === 'cancelled') {
        throw new Error('PromptInterceptor: intent extraction cancelled by user');
      }
      if (result.decision === 'accepted') {
        activeBundle = result.bundle ?? originalBundle;
      }
      // If rejected, we proceed with the original untampered bundle.
    }
    // --- End Interception ---

    const systemPrompt = activeBundle.combined;
    const activeTags = activeBundle.tags;
    let repairPromptUsed = false;
    let rawResponse = '';
    let validationErrors: string[] = [];
    let repairDiscovery: any;

    try {
      const response = await xpertService.sendMessage({
        systemMessage: systemPrompt,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(input),
          },
        ],
        tags: activeTags,
      });

      rawResponse = response.content;
      const { discovery: responseDiscovery } = response;
      let intent = xpertContractService.parseIntent(rawResponse);
      let wasDiscoveryUsed = intent?.wasDiscoveryUsed ?? false;
      const validation = intent ? xpertContractService.validateIntent(intent) : { isValid: false, errors: ['Parse failed'] };
      validationErrors = validation.errors;

      // --- Automatic Repair Logic ---
      // If the first response is invalid, we send the errors back to the AI for correction.
      if (!validation.isValid) {
        repairPromptUsed = true;
        const repairPrompt = INTENT_EXTRACTION_PROMPT.REPAIR_PROMPT.replace(
          '{errors}',
          validation.errors.join(', '),
        );

        const repairResponse = await xpertService.sendMessage({
          systemMessage: systemPrompt,
          messages: [
            { role: 'user', content: JSON.stringify(input) },
            { role: 'assistant', content: rawResponse },
            { role: 'user', content: repairPrompt },
          ],
          tags: activeTags,
        });

        repairDiscovery = repairResponse.discovery;
        rawResponse = repairResponse.content;
        intent = xpertContractService.parseIntent(rawResponse);
        wasDiscoveryUsed = intent?.wasDiscoveryUsed ?? false;
        const secondValidation = intent ? xpertContractService.validateIntent(intent) : { isValid: false, errors: ['Parse failed'] };
        validationErrors = secondValidation.errors;
      }

      const normalizedIntent = intent ? xpertContractService.normalizeIntent(intent) : DEFAULT_INTENT;

      return {
        intent: normalizedIntent,
        debug: {
          systemPrompt,
          rawResponse,
          parsedResponse: intent,
          validationErrors,
          repairPromptUsed,
          durationMs: Date.now() - startTime,
          success: !!intent,
          tags: activeTags,
          discovery: intent?.discovery || (repairPromptUsed ? repairDiscovery : responseDiscovery),
          wasDiscoveryUsed,
        },
      };
    } catch (error) {
      return {
        intent: DEFAULT_INTENT,
        debug: {
          systemPrompt,
          rawResponse,
          parsedResponse: null,
          validationErrors: [String(error)],
          repairPromptUsed,
          durationMs: Date.now() - startTime,
          success: false,
          tags: activeTags,
        },
      };
    }
  },

  /**
   * Constructs the system prompt used for intent extraction.
   *
   * @returns A structured XpertPromptBundle containing the base Discovery RAG prompt.
   */
  buildSystemPrompt(): XpertPromptBundle {
    const baseContent = INTENT_EXTRACTION_PROMPT.DISCOVERY_RAG_BASE_PROMPT;

    const basePart: PromptPart = {
      label: 'base',
      content: baseContent,
      editable: true,
      required: true,
    };

    return {
      id: 'intentExtraction',
      stage: 'intentExtraction',
      parts: [basePart],
      combined: baseContent,
    };
  },

  /**
   * Exposes the preprocessing logic for use by consumers.
   */
  preprocessInput: intakePreprocessor.preprocessInput,
};
