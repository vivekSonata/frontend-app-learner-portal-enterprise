import { xpertContractService } from '../xpertContract';
import { DEFAULT_INTENT } from '../../constants';

describe('xpertContractService', () => {
  describe('parseIntent', () => {
    it('parses valid JSON intent', () => {
      const raw = JSON.stringify({
        condensedQuery: 'software engineer',
        roles: ['Developer'],
        skillsRequired: ['React'],
        skillsPreferred: ['Next.js'],
        industries: ['Tech'],
        jobSources: ['Indeed'],
        learnerLevel: 'intermediate',
        timeCommitment: 'short',
        excludeTags: ['PHP'],
        discovery: { some: 'data' },
        wasDiscoveryUsed: true,
      });

      const result = xpertContractService.parseIntent(raw);
      expect(result).toEqual({
        condensedQuery: 'software engineer',
        roles: ['Developer'],
        skillsRequired: ['React'],
        skillsPreferred: ['Next.js'],
        industries: ['Tech'],
        jobSources: ['Indeed'],
        learnerLevel: 'intermediate',
        timeCommitment: 'short',
        excludeTags: ['PHP'],
        discovery: { some: 'data' },
        wasDiscoveryUsed: true,
      });
    });

    it('handles markdown fences', () => {
      const raw = '```json\n{"condensedQuery": "data science"}\n```';
      const result = xpertContractService.parseIntent(raw);
      expect(result?.condensedQuery).toBe('data science');
    });

    it('returns null for invalid JSON', () => {
      const result = xpertContractService.parseIntent('not json');
      expect(result).toBeNull();
    });
  });

  describe('normalizeIntent', () => {
    it('coerces unknown enum values to defaults', () => {
      const raw = {
        learnerLevel: 'wizard',
        timeCommitment: 'forever',
      };
      const result = xpertContractService.normalizeIntent(raw);
      expect(result.learnerLevel).toBe('introductory');
      expect(result.timeCommitment).toBe('medium');
    });

    it('ensures all arrays exist', () => {
      const result = xpertContractService.normalizeIntent({});
      expect(result.roles).toEqual([]);
      expect(result.skillsRequired).toEqual([]);
      expect(result.industries).toEqual([]);
    });

    it('uses default condensedQuery if missing', () => {
      const result = xpertContractService.normalizeIntent({});
      expect(result.condensedQuery).toBe(DEFAULT_INTENT.condensedQuery);
    });
  });

  describe('validateIntent', () => {
    it('is valid if it has query and roles', () => {
      const intent = {
        ...DEFAULT_INTENT,
        condensedQuery: 'test',
        roles: ['Role'],
      };
      const result = xpertContractService.validateIntent(intent);
      expect(result.isValid).toBe(true);
    });

    it('is invalid if both roles and skillsRequired are empty', () => {
      const intent = {
        ...DEFAULT_INTENT,
        condensedQuery: 'test',
        roles: [],
        skillsRequired: [],
      };
      const result = xpertContractService.validateIntent(intent);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Neither roles nor skillsRequired are present');
    });
  });

  describe('parseReasoning', () => {
    it('parses valid reasoning array', () => {
      const raw = JSON.stringify({
        reasonings: [
          { id: '1', reasoning: 'Good course' },
        ],
        discovery: { item: 1 },
        wasDiscoveryUsed: true,
      });
      const result = xpertContractService.parseReasoning(raw);
      expect(result?.reasonings).toHaveLength(1);
      expect(result?.reasonings[0]).toEqual({ id: '1', reasoning: 'Good course' });
      expect(result?.discovery).toEqual({ item: 1 });
      expect(result?.wasDiscoveryUsed).toBe(true);
    });
  });
});
