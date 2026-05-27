import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { DebugConsole } from '../DebugConsole';
import { AIPathwaysResponseModel } from '../../types';
import { exportResponseModel } from '../../utils/exportResponseModel';

jest.mock('../../utils/exportResponseModel');
// eslint-disable-next-line func-names
jest.mock('../../../search/SearchCourseCard', () => function () {
  return <div data-testid="course-card">Course Card</div>;
});

describe('DebugConsole', () => {
  const mockResponse: AIPathwaysResponseModel = {
    requestId: 'test-req-id',
    stages: {
      intentExtraction: {
        durationMs: 200,
        success: true,
        systemPrompt: 'intent system prompt',
        rawResponse: 'intent raw response',
        parsedResponse: { condensedQuery: 'test' },
        validationErrors: ['err1'],
        repairPromptUsed: true,
      },
      careerRetrieval: {
        durationMs: 150,
        success: true,
        resultCount: 2,
        trace: {
          query: 'cloud computing',
          hitsPerPage: 10,
          requiredSkillFilters: ['Cloud Computing'],
          preferredSkillFilters: ['Python'],
          learnerLevel: 'intermediate',
          droppedSkillInputs: [],
          resultSummaries: [{ id: '1', title: 'Cloud Engineer', skillCount: 5 }],
        },
      },
      catalogFacetSnapshot: {
        durationMs: 50,
        success: true,
        trace: {
          skillNamesCount: 10,
          sampleSkillNames: ['Skill1'],
          skillsDotNameCount: 5,
          subjectsCount: 3,
          sampleSubjects: ['Subj1'],
          levelTypeCount: 2,
          partnersNameCount: 4,
        },
      },
      rulesFirstMapping: {
        durationMs: 30,
        success: true,
        trace: {
          termsConsidered: 5,
          exactMatchCount: 1,
          exactMatches: ['Exact'],
          aliasMatchCount: 1,
          aliasMatches: ['Alias'],
          unmatchedCount: 1,
          unmatched: ['Unmatched'],
          tieringTrace: [{
            name: 'Cloud Computing',
            normalizedName: 'cloud computing',
            tier: 'broad_anchor' as const,
            decision: 'strict' as const,
            source: 'intent_required' as const,
            score: 80,
            significance: 1200,
            uniquePostings: 12000,
            catalogSkill: 'Cloud Computing',
            catalogField: 'skill_names' as const,
            matchMethod: 'exact' as const,
          }],
          strictCandidateCount: 1,
          boostCandidateCount: 0,
          roleDifferentiatorMatches: [],
          narrowSignalMatches: [],
          noiseDropped: [],
          broadAnchorMatches: ['Cloud Computing'],
          boostMatches: [],
        },
      },
      catalogTranslation: {
        durationMs: 40,
        success: true,
        trace: {
          query: '',
          queryAlternates: ['Software Engineer'],
          strictSkillCount: 1,
          strictSkills: ['Strict'],
          boostSkillCount: 0,
          boostSkills: [],
          droppedSkillCount: 0,
          courseSearchMode: 'facet-first' as const,
          facetMatchCount: 1,
          facetMatchRate: 1,
        },
      },
      retrievalLadder: {
        durationMs: 0,
        success: true,
        trace: {
          winnerStep: 1,
          attempts: [
            {
              step: 1,
              label: 'Step 1',
              searchMode: 'hybrid-broad' as const,
              hitCount: 1,
              winner: true,
              query: 'step 1 query',
              strictSkillsUsed: ['Cloud Computing'],
              boostSkillsUsed: [],
              rerankApplied: true,
              rerankTrace: {
                inputCount: 1,
                outputCount: 1,
                courseScores: [{
                  objectID: 'c1',
                  title: 'Course 1',
                  originalRank: 0,
                  finalRank: 0,
                  score: 10,
                  matchedStrictSkills: ['Cloud Computing'],
                  matchedBoostSkills: [],
                  levelCompatibility: 'matched' as const,
                }],
              },
              hits: [{ objectID: 'c1', title: 'Course 1' } as any],
            },
          ],
        },
      },
      courseRetrieval: {
        durationMs: 100,
        success: true,
        resultCount: 1,
        hits: [{ objectID: 'c1', title: 'Course 1' } as any],
        winnerStep: 1,
        selectedCourseTitles: ['Cloud Fundamentals'],
        requestSummary: { winningQuery: 'cloud computing' },
      },
      pathwayEnrichment: {
        durationMs: 300,
        success: true,
        systemPrompt: 'enrichment system prompt',
        rawResponse: 'enrichment raw response',
      },
    },
    promptDebug: [
      {
        label: 'Prompt 1',
        decision: 'accepted',
        timestamp: '2023-01-01',
        original: {
          id: '1',
          stage: 'intentExtraction',
          combined: 'orig1',
          parts: [],
        },
        edited: {
          id: '1',
          stage: 'intentExtraction',
          combined: 'edit1',
          parts: [],
        },
        validationWarnings: [{ code: 'W1', severity: 'warning', message: 'msg1' }],
      },
      {
        label: 'Prompt 2',
        decision: 'rejected',
        timestamp: '2023-01-02',
        original: {
          id: '1', stage: 'intentExtraction', combined: 'orig2', parts: [],
        },
      },
      {
        label: 'Prompt 3',
        decision: 'cancelled',
        timestamp: '2023-01-03',
        original: {
          id: '1', stage: 'intentExtraction', combined: 'orig3', parts: [],
        },
      },
    ],
  };

  it('renders nothing if response is null', () => {
    const { container } = render(<DebugConsole response={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all sections and handles export', () => {
    render(
      <IntlProvider locale="en">
        <DebugConsole response={mockResponse} />
      </IntlProvider>,
    );

    expect(screen.getByText(/AI Pathways Debug Console/i)).toBeInTheDocument();
    expect(screen.getByText(/Request ID: test-req-id/i)).toBeInTheDocument();

    // Check various stages
    expect(screen.getByText(/Stage 2: Xpert Intent Extraction/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 3: Career Retrieval/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 3b: Catalog Facet Snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Stage 4: Course Retrieval/i)).toBeInTheDocument();

    // Check content inside stages (might need to open them if they are in <details>)
    expect(screen.getByText(/intent system prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/enrichment system prompt/i)).toBeInTheDocument();

    // Check prompt debug section
    expect(screen.getByText(/Prompt Interceptions \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Prompt 1/i)).toBeInTheDocument();
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.getByText(/\[W1] msg1/i)).toBeInTheDocument();

    // Check export button
    const exportBtn = screen.getByRole('button', { name: /export json/i });
    fireEvent.click(exportBtn);
    expect(exportResponseModel).toHaveBeenCalledWith(mockResponse);
  });

  it('renders CourseRetrievalSection with no hits', () => {
    const responseWithNoHits = {
      ...mockResponse,
      stages: {
        ...mockResponse.stages,
        courseRetrieval: {
          durationMs: 0, success: true, resultCount: 0, hits: [],
        },
      },
    };
    render(
      <IntlProvider locale="en">
        <DebugConsole response={responseWithNoHits} />
      </IntlProvider>,
    );
    expect(screen.getByText(/No courses returned for the winning step./i)).toBeInTheDocument();
  });

  it('renders hybrid-broad trace data — career retrieval query, tiering table, rerank', () => {
    render(
      <IntlProvider locale="en">
        <DebugConsole response={mockResponse} />
      </IntlProvider>,
    );

    // Career retrieval trace
    expect(screen.getAllByText(/cloud computing/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Required broad filters/i)).toBeInTheDocument();

    // Tiering table
    expect(screen.getByText(/Skill Tiering Detail/i)).toBeInTheDocument();
    expect(screen.getAllByText(/broad_anchor/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/strict/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cloud Computing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1200/i).length).toBeGreaterThan(0);

    // Retrieval ladder hybrid-broad badge
    expect(screen.getAllByText(/hybrid-broad/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Strict facets/i)).toBeInTheDocument();

    // Course retrieval winner step and selected courses
    expect(screen.getAllByText(/Winner step/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cloud Fundamentals/i).length).toBeGreaterThan(0);
  });

  it('renders null-safe with minimal payload (no new trace fields)', () => {
    const minimalResponse: AIPathwaysResponseModel = {
      requestId: 'min-req',
      stages: {
        intentExtraction: {
          durationMs: 10,
          success: true,
          systemPrompt: '',
          rawResponse: '',
          parsedResponse: {},
          validationErrors: [],
          repairPromptUsed: false,
        },
        careerRetrieval: { durationMs: 10, success: true, resultCount: 0 },
        courseRetrieval: {
          durationMs: 10, success: true, resultCount: 0, hits: [],
        },
        pathwayEnrichment: {
          durationMs: 10, success: true, systemPrompt: '', rawResponse: '',
        },
      },
    };

    expect(() => render(
      <IntlProvider locale="en">
        <DebugConsole response={minimalResponse} />
      </IntlProvider>,
    )).not.toThrow();
  });
});
