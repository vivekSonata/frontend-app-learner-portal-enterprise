/**
 * Tests for the prompt interception layer.
 *
 * Coverage:
 *  - usePromptInterceptor hook: disabled/pass-through, accept, reject, cancel
 *  - extractIntent service: disabled, accept, reject, cancel
 */

import { renderHook, act } from '@testing-library/react';
import { usePromptInterceptor, InterceptResult } from '../usePromptInterceptor';
import { intentExtractionXpertService } from '../../services/intentExtraction.xpert.service';
import { xpertService } from '../../services/xpert.service';
import { XpertPromptBundle } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../services/xpert.service', () => ({
  xpertService: {
    sendMessage: jest.fn(),
  },
}));

jest.mock('../../services/intentExtraction.xpert.service', () => {
  const actual = jest.requireActual('../../services/intentExtraction.xpert.service');
  return {
    ...actual,
    intentExtractionXpertService: {
      ...actual.intentExtractionXpertService,
      buildSystemPrompt: actual.intentExtractionXpertService.buildSystemPrompt,
      extractIntent: actual.intentExtractionXpertService.extractIntent.bind(
        actual.intentExtractionXpertService,
      ),
    },
  };
});

jest.mock('../../services/promptValidation', () => ({
  validateBundle: jest.fn().mockReturnValue({ valid: true, issues: [], warnings: [] }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeBundle = (combined = 'test prompt'): XpertPromptBundle => ({
  id: 'bundle-test',
  stage: 'intentExtraction',
  combined,
  parts: [{
    label: 'base', content: combined, editable: true, required: true,
  }],
});

const makeEditedBundle = (combined = 'edited prompt'): XpertPromptBundle => ({
  id: 'bundle-edited',
  stage: 'intentExtraction',
  combined,
  parts: [{
    label: 'base', content: combined, editable: true, required: true,
  }],
});

const mockXpertResponse = (content = '{"result": "ok"}') => {
  (xpertService.sendMessage as jest.Mock).mockResolvedValue({ content, role: 'assistant' });
};

// ---------------------------------------------------------------------------
// Suite 1: usePromptInterceptor hook unit tests
// ---------------------------------------------------------------------------

describe('usePromptInterceptor hook', () => {
  describe('accept path (resolves via accept())', () => {
    it('resolves with accepted decision and original bundle when accept() is called', async () => {
      const { result } = renderHook(() => usePromptInterceptor());
      const bundle = makeBundle();
      const context = { label: 'Test', messages: [] };

      let interceptResult: InterceptResult | undefined;
      act(() => {
        result.current.interceptPrompt(bundle, context).then((r) => { interceptResult = r; });
      });

      await act(async () => {
        result.current.accept();
      });

      expect(interceptResult?.decision).toBe('accepted');
      expect(interceptResult?.bundle).toBe(bundle);
    });

    it('sets isPending to true while waiting and false after resolution', async () => {
      const { result } = renderHook(() => usePromptInterceptor());

      act(() => {
        result.current.interceptPrompt(makeBundle(), { label: 'Test', messages: [] });
      });

      expect(result.current.isPending).toBe(true);

      await act(async () => {
        result.current.accept();
      });

      expect(result.current.isPending).toBe(false);
    });
  });

  describe('accept with edited bundle', () => {
    it('resolves with accepted decision and original bundle when no edited bundle supplied', async () => {
      const { result } = renderHook(() => usePromptInterceptor());
      const bundle = makeBundle('original');
      const context = { label: 'Test', messages: [] };

      let interceptResult: InterceptResult | undefined;
      act(() => {
        result.current.interceptPrompt(bundle, context).then((r) => { interceptResult = r; });
      });

      await act(async () => {
        result.current.accept();
      });

      expect(interceptResult?.decision).toBe('accepted');
      expect(interceptResult?.bundle?.combined).toBe('original');
    });

    it('resolves with accepted decision and edited bundle when an edited bundle is supplied', async () => {
      const { result } = renderHook(() => usePromptInterceptor());
      const bundle = makeBundle('original');
      const editedBundle = makeEditedBundle('edited');
      const context = { label: 'Test', messages: [] };

      let interceptResult: InterceptResult | undefined;
      act(() => {
        result.current.interceptPrompt(bundle, context).then((r) => { interceptResult = r; });
      });

      await act(async () => {
        result.current.accept(editedBundle);
      });

      expect(interceptResult?.decision).toBe('accepted');
      expect(interceptResult?.bundle?.combined).toBe('edited');
    });
  });

  describe('reject', () => {
    it('resolves with rejected decision', async () => {
      const { result } = renderHook(() => usePromptInterceptor());
      const bundle = makeBundle();
      const context = { label: 'Test', messages: [] };

      let interceptResult: InterceptResult | undefined;
      act(() => {
        result.current.interceptPrompt(bundle, context).then((r) => { interceptResult = r; });
      });

      await act(async () => {
        result.current.reject();
      });

      expect(interceptResult?.decision).toBe('rejected');
    });
  });

  describe('cancel', () => {
    it('resolves with cancelled decision', async () => {
      const { result } = renderHook(() => usePromptInterceptor());
      const bundle = makeBundle();
      const context = { label: 'Test', messages: [] };

      let interceptResult: InterceptResult | undefined;
      act(() => {
        result.current.interceptPrompt(bundle, context).then((r) => { interceptResult = r; });
      });

      await act(async () => {
        result.current.cancel();
      });

      expect(interceptResult?.decision).toBe('cancelled');
    });
  });

  describe('sequential interceptions', () => {
    it('handles multiple successive interceptions on the same hook instance', async () => {
      const { result } = renderHook(() => usePromptInterceptor());
      const context = { label: 'Test', messages: [] };

      const results: InterceptResult[] = [];

      // First interception — accept
      act(() => {
        result.current.interceptPrompt(makeBundle('first'), context).then((r) => results.push(r));
      });
      await act(async () => { result.current.accept(); });

      // Second interception — reject
      act(() => {
        result.current.interceptPrompt(makeBundle('second'), context).then((r) => results.push(r));
      });
      await act(async () => { result.current.reject(); });

      expect(results[0]?.decision).toBe('accepted');
      expect(results[1]?.decision).toBe('rejected');
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2: extractIntent service interception integration
// ---------------------------------------------------------------------------

describe('intentExtractionXpertService.extractIntent — interception', () => {
  const mockInput = {
    bringsYouHereRes: 'I want to learn coding',
    careerGoalRes: 'Software Engineer',
    backgroundRes: 'Beginner',
    industryRes: 'Tech',
    learningPrefRes: 'videos',
    timeAvailableRes: '5h',
    certificateRes: 'yes',
  };

  const validXpertJson = JSON.stringify({
    condensedQuery: 'software engineering',
    roles: ['Software Engineer'],
    skillsRequired: ['JavaScript'],
    skillsPreferred: [],
    learnerLevel: 'beginner',
    queryTerms: [],
    excludeTags: [],
    timeCommitment: 'low',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disabled — calls xpert and returns result without interceptor', async () => {
    mockXpertResponse(validXpertJson);
    const result = await intentExtractionXpertService.extractIntent(mockInput as any);
    expect(xpertService.sendMessage).toHaveBeenCalled();
    expect(result.intent).toBeDefined();
  });

  it('accept — proceeds with original bundle when no edits', async () => {
    mockXpertResponse(validXpertJson);

    const interceptPrompt = jest.fn().mockResolvedValue({
      decision: 'accepted',
      bundle: undefined,
    } as InterceptResult);

    await intentExtractionXpertService.extractIntent(mockInput as any, interceptPrompt);

    expect(interceptPrompt).toHaveBeenCalledTimes(1);
    expect(xpertService.sendMessage).toHaveBeenCalled();
    const callArg = (xpertService.sendMessage as jest.Mock).mock.calls[0][0];
    // systemMessage must be a non-empty string (from the original bundle)
    expect(typeof callArg.systemMessage).toBe('string');
    expect(callArg.systemMessage.length).toBeGreaterThan(0);
  });

  it('accept with edited bundle — uses edited combined string for sendMessage', async () => {
    const editedCombined = 'EDITED SYSTEM PROMPT';
    mockXpertResponse(validXpertJson);

    const editedBundle = makeEditedBundle(editedCombined);
    const interceptPrompt = jest.fn().mockResolvedValue({
      decision: 'accepted',
      bundle: editedBundle,
    } as InterceptResult);

    await intentExtractionXpertService.extractIntent(mockInput as any, interceptPrompt);

    const callArg = (xpertService.sendMessage as jest.Mock).mock.calls[0][0];
    expect(callArg.systemMessage).toBe(editedCombined);
  });

  it('reject — falls back to original bundle and proceeds', async () => {
    mockXpertResponse(validXpertJson);

    const interceptPrompt = jest.fn().mockResolvedValue({
      decision: 'rejected',
    } as InterceptResult);

    await intentExtractionXpertService.extractIntent(mockInput as any, interceptPrompt);

    expect(xpertService.sendMessage).toHaveBeenCalled();
    const callArg = (xpertService.sendMessage as jest.Mock).mock.calls[0][0];
    // Should use the real original bundle (non-empty)
    expect(typeof callArg.systemMessage).toBe('string');
    expect(callArg.systemMessage.length).toBeGreaterThan(0);
  });

  it('cancel — throws and does NOT call xpertService.sendMessage', async () => {
    const interceptPrompt = jest.fn().mockResolvedValue({
      decision: 'cancelled',
    } as InterceptResult);

    await expect(
      intentExtractionXpertService.extractIntent(mockInput as any, interceptPrompt),
    ).rejects.toThrow('cancelled by user');

    expect(xpertService.sendMessage).not.toHaveBeenCalled();
  });
});
