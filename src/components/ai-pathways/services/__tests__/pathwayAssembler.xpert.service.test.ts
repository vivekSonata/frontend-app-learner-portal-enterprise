import { pathwayAssemblerXpertService } from '../pathwayAssembler.xpert.service';
import { xpertService } from '../xpert.service';
import { xpertContractService } from '../xpertContract';
import { LearningPathway, XpertIntent } from '../../types';

jest.mock('../xpert.service');
jest.mock('../xpertContract');

describe('pathwayAssemblerXpertService', () => {
  const mockPathway: LearningPathway = {
    // @ts-ignore
    id: 'p1',
    title: 'Pathway 1',
    courses: [
      {
        id: 'c1', title: 'Course 1', status: 'not_started', level: 'Beginner', reasoning: '', order: 1, skills: [],
      },
    ],
  };

  const mockIntent: XpertIntent = {
    roles: ['Software Engineer'],
    skillsRequired: ['React'],
    skillsPreferred: [],
    industries: [],
    jobSources: [],
    condensedQuery: 'react',
    learnerLevel: 'introductory',
    timeCommitment: 'medium',
    excludeTags: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enrichWithReasoning', () => {
    it('returns early if no courses', async () => {
      const result = await pathwayAssemblerXpertService.enrichWithReasoning(
        { ...mockPathway, courses: [] },
        mockIntent,
      );
      expect(result.debug.success).toBe(true);
      expect(result.debug.durationMs).toBe(0);
    });

    it('enriches pathway successfully', async () => {
      (xpertService.sendMessage as jest.Mock).mockResolvedValue({ content: '{"reasonings": [{"id": "c1", "reasoning": "New reasoning"}]}' });
      (xpertContractService.parseReasoning as jest.Mock).mockReturnValue({
        reasonings: [{ id: 'c1', reasoning: 'New reasoning' }],
      });

      const result = await pathwayAssemblerXpertService.enrichWithReasoning(mockPathway, mockIntent);

      expect(result.debug.success).toBe(true);
      expect(result.pathway.courses[0].reasoning).toBe('New reasoning');
    });

    it('handles parse error', async () => {
      (xpertService.sendMessage as jest.Mock).mockResolvedValue({ content: 'invalid' });
      (xpertContractService.parseReasoning as jest.Mock).mockReturnValue(null);

      const result = await pathwayAssemblerXpertService.enrichWithReasoning(mockPathway, mockIntent);

      expect(result.debug.success).toBe(false);
      expect(result.pathway).toEqual(mockPathway);
    });

    it('handles service error', async () => {
      (xpertService.sendMessage as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await pathwayAssemblerXpertService.enrichWithReasoning(mockPathway, mockIntent);

      expect(result.debug.success).toBe(false);
      expect(result.pathway).toEqual(mockPathway);
    });

    it('supports prompt interception', async () => {
      const mockInterceptor = jest.fn().mockResolvedValue({
        decision: 'accepted',
        bundle: {
          combined: 'Edited system prompt',
          tags: ['edited-tag'],
          parts: [],
        },
      });

      (xpertService.sendMessage as jest.Mock).mockResolvedValue({ content: '{"reasonings": []}' });
      (xpertContractService.parseReasoning as jest.Mock).mockReturnValue({ reasonings: [] });

      await pathwayAssemblerXpertService.enrichWithReasoning(mockPathway, mockIntent, mockInterceptor);

      expect(mockInterceptor).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pathwayEnrichment' }),
        expect.objectContaining({ label: 'Pathway Enrichment' }),
      );

      expect(xpertService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        systemMessage: 'Edited system prompt',
        tags: ['edited-tag'],
      }));
    });

    it('handles interception cancellation', async () => {
      const mockInterceptor = jest.fn().mockResolvedValue({ decision: 'cancelled' });

      await expect(
        pathwayAssemblerXpertService.enrichWithReasoning(mockPathway, mockIntent, mockInterceptor),
      ).rejects.toThrow('PromptInterceptor: pathway enrichment cancelled by user');
    });
  });
});
