import axios from 'axios';
import { getConfig } from '@edx/frontend-platform';
import { xpertService } from '../xpert.service';

jest.mock('axios');
jest.mock('@edx/frontend-platform', () => ({
  getConfig: jest.fn(),
}));

describe('xpertService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const mockedGetConfig = getConfig as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('throws an error if XPERT_AI_CLIENT_ID is not configured', async () => {
      mockedGetConfig.mockReturnValue({
        XPERT_AI_CLIENT_ID: null,
      });

      await expect(xpertService.sendMessage({
        messages: [],
        systemMessage: 'test',
      })).rejects.toThrow('XPERT_AI_CLIENT_ID is not configured');
    });

    it('sends a POST request to the correct URL with correct body', async () => {
      mockedGetConfig.mockReturnValue({
        XPERT_AI_CLIENT_ID: 'test-client-id',
        XPERT_API_BASE_URL: 'http://test-api.com',
      });

      const mockResponse = {
        data: [{ content: 'AI response', role: 'assistant', discovery: { test: 'data' } }],
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const request = {
        messages: [{ role: 'user', content: 'hello' }],
        systemMessage: 'You are a bot',
        conversationId: 'conv-123',
      };

      const result = await xpertService.sendMessage(request as any);

      expect(mockedAxios.post).toHaveBeenCalledWith('http://test-api.com/v1/message', {
        client_id: 'test-client-id',
        messages: request.messages,
        conversation_id: request.conversationId,
        system_message: request.systemMessage,
        stream: false,
      });

      expect(result).toEqual(mockResponse.data[0]);
    });

    it('includes tags in the payload when provided', async () => {
      mockedGetConfig.mockReturnValue({
        XPERT_AI_CLIENT_ID: 'test-client-id',
        XPERT_API_BASE_URL: 'http://test-api.com',
      });

      mockedAxios.post.mockResolvedValue({ data: [{}] });

      await xpertService.sendMessage({
        messages: [],
        tags: ['tag1', 'tag2'],
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        tags: ['tag1', 'tag2'],
      }));
    });

    it('omits tags field when tags are empty or undefined', async () => {
      mockedGetConfig.mockReturnValue({
        XPERT_AI_CLIENT_ID: 'test-client-id',
        XPERT_API_BASE_URL: 'http://test-api.com',
      });

      mockedAxios.post.mockResolvedValue({ data: [{}] });

      await xpertService.sendMessage({
        messages: [],
        tags: [],
      });

      const payload = mockedAxios.post.mock.calls[0][1];
      expect(payload).not.toHaveProperty('tags');

      await xpertService.sendMessage({
        messages: [],
        tags: undefined,
      });

      const secondPayload = mockedAxios.post.mock.calls[1][1];
      expect(secondPayload).not.toHaveProperty('tags');
    });
  });
});
