/**
 * Return type for `intentExtractionXpertService.extractIntent`.
 *
 * Wraps the extracted XpertIntent alongside execution metadata for
 * tracing, debugging, and display in the DebugConsole.
 */
export interface XpertExtractionResult {
  /** The structured intent parsed from the Xpert response. */
  intent: any;
  /** Execution metadata and raw request/response data for debugging. */
  debug: {
    /** The system prompt sent to Xpert. */
    systemPrompt: string;
    /** The raw text response from Xpert before parsing. */
    rawResponse: string;
    /** The parsed JSON response object. */
    parsedResponse: any;
    /** Any schema validation errors found on the parsed response. */
    validationErrors: string[];
    /** Whether the auto-repair prompt was triggered due to a parse failure. */
    repairPromptUsed: boolean;
    /** Time taken for the full extraction call in milliseconds. */
    durationMs: number;
    /** Whether the extraction completed successfully. */
    success: boolean;
    /** RAG control tags used for this call. */
    tags?: string[];
    /** Discovery documents surfaced by Xpert RAG during this call. */
    discovery?: any;
    /** Whether RAG document retrieval was active for this call. */
    wasDiscoveryUsed?: boolean;
  };
}

/**
 * Return type for `pathwayAssemblerXpertService.enrichWithReasoning`.
 *
 * Wraps the enriched LearningPathway alongside execution metadata for
 * tracing, debugging, and display in the DebugConsole.
 */
export interface XpertEnrichmentResult {
  /** The pathway with AI-generated course reasoning attached. */
  pathway: any;
  /** Execution metadata and raw request/response data for debugging. */
  debug: {
    /** The system prompt sent to Xpert. */
    systemPrompt: string;
    /** The raw text response from Xpert before parsing. */
    rawResponse: string;
    /** Time taken for the full enrichment call in milliseconds. */
    durationMs: number;
    /** Whether the enrichment completed successfully. */
    success: boolean;
    /** RAG control tags used for this call. */
    tags?: string[];
    /** Discovery documents surfaced by Xpert RAG during this call. */
    discovery?: any;
    /** Whether RAG document retrieval was active for this call. */
    wasDiscoveryUsed?: boolean;
  };
}
