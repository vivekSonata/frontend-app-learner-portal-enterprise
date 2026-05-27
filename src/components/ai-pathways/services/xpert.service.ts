import { getConfig } from '@edx/frontend-platform';
// eslint-disable-next-line import/no-extraneous-dependencies
import axios from 'axios';
import { XpertMessageRequest, XpertMessageResponse } from '../types';

/**
 * Low-level HTTP client for the Xpert AI platform.
 *
 * This service handles the direct transport layer to the Xpert `/v1/message`
 * endpoint. All higher-level concerns (prompt construction, response parsing,
 * retry logic) are handled by the calling service.
 *
 * Pipeline context: consumed by `intentExtractionXpertService` and
 * `pathwayAssemblerXpertService`. It should not be called directly by hooks
 * or UI components.
 */
export const xpertService = {
  /**
   * Sends a message to the Xpert AI platform and returns the first response object.
   *
   * Tags passed in the request scope Xpert's RAG document retrieval — they
   * determine which knowledge base documents are surfaced for context injection.
   * Omitting tags (or passing an empty array) disables RAG for that call.
   *
   * @param request The fully-formed message payload including conversation history,
   *   an optional system message, and RAG control tags.
   * @returns A promise resolving to the Xpert response object.
   * @throws When `XPERT_AI_CLIENT_ID` is not configured, or when the network request fails.
   */
  async sendMessage(request: XpertMessageRequest): Promise<XpertMessageResponse> {
    const clientId = getConfig().XPERT_AI_CLIENT_ID;
    if (!clientId) {
      throw new Error('XPERT_AI_CLIENT_ID is not configured. Ensure it is set in the private environment file.');
    }

    const baseUrl = getConfig().XPERT_API_BASE_URL;
    const url = `${baseUrl}/v1/message`;

    // Tags scope RAG document retrieval.
    // If tags are empty or undefined, the field is omitted from the payload.
    const payload = {
      client_id: clientId,
      messages: request.messages,
      conversation_id: request.conversationId,
      ...(request.systemMessage ? { system_message: request.systemMessage } : {}),
      ...(typeof request.stream === 'boolean' ? { stream: request.stream } : { stream: false }),
      ...(request.tags?.length ? { tags: request.tags } : {}),
    };

    // TODO: confirm auth header requirements with Xpert team —
    //  batch/dropzone endpoints require Authorization but /v1/message docs do not specify
    const response = await axios.post(url, payload);

    return response.data[0];
  },
};
