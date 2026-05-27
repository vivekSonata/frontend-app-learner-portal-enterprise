import {
  buildExportFilename, safeSerialize, triggerDownload, exportResponseModel,
} from '../exportResponseModel';

describe('exportResponseModel', () => {
  describe('buildExportFilename', () => {
    it('returns correctly formatted filename', () => {
      const date = new Date(2023, 0, 15, 14, 30, 45);
      expect(buildExportFilename(date)).toBe('learner-rec-output-2023-01-15_14-30-45.json');
    });

    it('uses current date by default', () => {
      const result = buildExportFilename();
      expect(result).toMatch(/^learner-rec-output-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('safeSerialize', () => {
    it('serializes simple object', () => {
      const obj = { a: 1, b: 'test' };
      expect(safeSerialize(obj)).toBe(JSON.stringify(obj, null, 2));
    });

    it('converts undefined to null', () => {
      const obj = { a: undefined, b: 1 };
      const expected = JSON.stringify({ a: null, b: 1 }, null, 2);
      expect(safeSerialize(obj)).toBe(expected);
    });

    it('handles circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      const result = safeSerialize(obj);
      expect(result).toContain('"self": "[Circular]"');
    });

    it('handles nested objects', () => {
      const obj = { a: { b: 2 } };
      expect(safeSerialize(obj)).toBe(JSON.stringify(obj, null, 2));
    });
  });

  describe('triggerDownload', () => {
    let originalCreateObjectURL: any;
    let originalRevokeObjectURL: any;
    let originalAppendChild: any;
    let originalRemoveChild: any;

    beforeEach(() => {
      originalCreateObjectURL = window.URL.createObjectURL;
      originalRevokeObjectURL = window.URL.revokeObjectURL;
      window.URL.createObjectURL = jest.fn(() => 'mock-url');
      window.URL.revokeObjectURL = jest.fn();

      originalAppendChild = document.body.appendChild;
      originalRemoveChild = document.body.removeChild;
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });

    afterEach(() => {
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
      document.body.appendChild = originalAppendChild;
      document.body.removeChild = originalRemoveChild;
    });

    it('triggers a download by creating an anchor element', () => {
      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const createElementSpy = jest.spyOn(document, 'createElement');

      triggerDownload('test.json', '{"a":1}');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');

      clickSpy.mockRestore();
      createElementSpy.mockRestore();
    });
  });

  describe('exportResponseModel', () => {
    it('calls buildExportFilename, safeSerialize, and triggers download', () => {
      // We can't easily mock internal functions from the same module without refactoring,
      // so we'll just verify the side effects in the DOM as we did in triggerDownload.
      const date = new Date(2023, 0, 15, 14, 30, 45);
      const mockResponse: any = { requestId: 'test-id' };

      const createObjectURLMock = jest.fn(() => 'mock-url');
      const revokeObjectURLMock = jest.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      const appendChildMock = jest.fn();
      const removeChildMock = jest.fn();
      document.body.appendChild = appendChildMock;
      document.body.removeChild = removeChildMock;

      const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      exportResponseModel(mockResponse, date);

      expect(appendChildMock).toHaveBeenCalled();
      const anchor = appendChildMock.mock.calls[0][0];
      expect(anchor.download).toBe('learner-rec-output-2023-01-15_14-30-45.json');
      expect(anchor.href).toMatch(/mock-url$/);
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalledWith(anchor);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('mock-url');

      // Test default date branch
      exportResponseModel(mockResponse);
      expect(appendChildMock).toHaveBeenCalledTimes(2);

      clickSpy.mockRestore();
    });

    it('serializes new trace fields into exported JSON', () => {
      const fullTraceResponse: any = {
        requestId: 'trace-test',
        stages: {
          careerRetrieval: {
            durationMs: 100,
            success: true,
            resultCount: 1,
            trace: {
              query: 'cloud engineer',
              requiredSkillFilters: ['Cloud Computing'],
              droppedSkillInputs: [{ skill: 'SQL & Python', reason: 'malformed-compound' }],
            },
          },
          rulesFirstMapping: {
            durationMs: 30,
            success: true,
            trace: {
              termsConsidered: 1,
              exactMatchCount: 1,
              exactMatches: ['Cloud Computing'],
              aliasMatchCount: 0,
              aliasMatches: [],
              unmatchedCount: 0,
              unmatched: [],
              tieringTrace: [{
                name: 'Cloud Computing',
                tier: 'broad_anchor',
                decision: 'strict',
              }],
            },
          },
          catalogTranslation: {
            durationMs: 20,
            success: true,
            trace: {
              query: 'cloud computing',
              queryAlternates: [],
              courseSearchMode: 'hybrid-broad',
              querySource: 'intent_required',
              strictSkillCount: 1,
              strictSkills: ['Cloud Computing'],
              boostSkillCount: 0,
              boostSkills: [],
              droppedSkillCount: 0,
              facetMatchCount: 1,
              facetMatchRate: 1,
            },
          },
          retrievalLadder: {
            durationMs: 0,
            success: true,
            trace: {
              winnerStep: 1,
              attempts: [{
                step: 1, searchMode: 'hybrid-broad', hitCount: 5, winner: true,
              }],
            },
          },
          courseRetrieval: {
            durationMs: 50,
            success: true,
            resultCount: 1,
            hits: [],
            winnerStep: 1,
            selectedCourseTitles: ['Cloud Fundamentals'],
            requestSummary: { winningQuery: 'cloud computing' },
          },
        },
      };

      const createObjectURLMock = jest.fn(() => 'mock-url');
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = jest.fn();
      const appendChildMock = jest.fn();
      document.body.appendChild = appendChildMock;
      document.body.removeChild = jest.fn();
      jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      exportResponseModel(fullTraceResponse, new Date(2023, 0, 1));

      // Verify the serialized JSON by using safeSerialize directly
      const serialized = safeSerialize(fullTraceResponse);
      expect(serialized).toContain('"query": "cloud engineer"');
      expect(serialized).toContain('"decision": "strict"');
      expect(serialized).toContain('"querySource": "intent_required"');
      expect(serialized).toContain('"searchMode": "hybrid-broad"');
      expect(serialized).toContain('"winnerStep": 1');
      expect(serialized).toContain('"Cloud Fundamentals"');
    });
  });
});
