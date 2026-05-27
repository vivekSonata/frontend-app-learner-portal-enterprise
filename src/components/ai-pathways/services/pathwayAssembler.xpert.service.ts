import { xpertService } from './xpert.service';
import { xpertContractService } from './xpertContract';
import {
  LearningPathway, XpertIntent, XpertPromptBundle, PromptPart, XpertMessage,
} from '../types';
import { XpertEnrichmentResult } from './xpertDebug';
import { PATHWAY_ENRICHMENT_PROMPT } from '../constants';
import { PromptInterceptFn } from './intentExtraction.xpert.service';
import { InterceptContext } from '../hooks/usePromptInterceptor';

/**
 * AI service for enriching a learning pathway with personalized reasoning.
 *
 * Pipeline context: This is the final stage of the generation process. It takes
 * the retrieved courses and the learner's intent, and uses Xpert to generate
 * encouraging, goal-oriented explanations for why each course was selected.
 */
export const pathwayAssemblerXpertService = {
  /**
   * Enriches the provided pathway with AI-generated reasoning for each course.
   *
   * @param pathway The assembled pathway containing retrieved courses.
   * @param intent The user's search intent (used for personalization context).
   * @param interceptPrompt Optional hook to allow manual prompt editing in debug mode.
   * @param tags Optional RAG tags to scope document retrieval.
   * @returns A promise resolving to an enriched pathway and execution metrics.
   */
  async enrichWithReasoning(
    pathway: LearningPathway,
    intent: XpertIntent,
    interceptPrompt?: PromptInterceptFn,
    tags?: string[],
  ): Promise<XpertEnrichmentResult> {
    const startTime = Date.now();
    if (!pathway.courses.length) {
      return {
        pathway,
        debug: {
          systemPrompt: '',
          rawResponse: '',
          durationMs: 0,
          success: true,
          tags,
        },
      };
    }

    /**
     * Prepare compact snippets of the course list and learner intent to reduce token usage.
     */
    const coursesSnippet = pathway.courses.map(c => `- ID: ${c.id}, Title: ${c.title}`).join('\n');
    const intentSnippet = `Goal: ${intent.roles.join(', ')}. Required Skills: ${intent.skillsRequired.join(', ')}.`;

    const originalBundle = this.buildSystemPrompt();
    originalBundle.tags = tags;

    // --- Interception Logic ---
    let activeBundle = originalBundle;
    const userContent = `User Context: ${intentSnippet}\n\nCourses:\n${coursesSnippet}`;

    if (interceptPrompt) {
      const userMessages: XpertMessage[] = [{ role: 'user', content: userContent }];
      const context: InterceptContext = {
        label: 'Pathway Enrichment',
        messages: userMessages,
        meta: { stage: 'pathwayEnrichment' },
      };
      const result = await interceptPrompt(originalBundle, context);
      if (result.decision === 'cancelled') {
        throw new Error('PromptInterceptor: pathway enrichment cancelled by user');
      }
      if (result.decision === 'accepted') {
        activeBundle = result.bundle ?? originalBundle;
      }
    }
    // --- End Interception ---

    const systemPrompt = activeBundle.combined;
    const activeTags = activeBundle.tags;

    try {
      const response = await xpertService.sendMessage({
        systemMessage: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
        tags: activeTags,
      });

      const parsed = xpertContractService.parseReasoning(response.content);
      if (!parsed) {
        return {
          pathway,
          debug: {
            systemPrompt,
            rawResponse: response.content,
            durationMs: Date.now() - startTime,
            success: false,
            tags: activeTags,
            discovery: response.discovery,
          },
        };
      }

      /**
       * Map the generated reasonings back to their respective courses based on the ID.
       */
      const enrichedCourses = pathway.courses.map(course => {
        const r = parsed.reasonings.find(item => item.id === course.id);
        return {
          ...course,
          reasoning: r ? r.reasoning : course.reasoning,
        };
      });

      return {
        pathway: { courses: enrichedCourses },
        debug: {
          systemPrompt,
          rawResponse: response.content,
          durationMs: Date.now() - startTime,
          success: true,
          tags: activeTags,
          discovery: parsed.discovery || response.discovery,
          wasDiscoveryUsed: parsed.wasDiscoveryUsed,
        },
      };
    } catch (error) {
      return {
        pathway,
        debug: {
          systemPrompt,
          rawResponse: '',
          durationMs: Date.now() - startTime,
          success: false,
          tags: activeTags,
        },
      };
    }
  },

  /**
   * Constructs the multi-part system prompt used for pathway enrichment.
   *
   * @returns A structured XpertPromptBundle containing the prompt segments.
   */
  buildSystemPrompt(): XpertPromptBundle {
    const baseContent = PATHWAY_ENRICHMENT_PROMPT.SYSTEM_MESSAGE_BASE;
    const jsonInstruction = PATHWAY_ENRICHMENT_PROMPT.JSON_INSTRUCTION;

    const basePart: PromptPart = {
      label: 'base',
      content: baseContent,
      editable: true,
      required: true,
    };

    const jsonPart: PromptPart = {
      label: 'json_instruction',
      content: jsonInstruction,
      editable: true,
      required: true,
    };

    return {
      id: 'pathwayEnrichment',
      stage: 'pathwayEnrichment',
      parts: [basePart, jsonPart],
      combined: `${baseContent}${jsonInstruction}`,
    };
  },
};
