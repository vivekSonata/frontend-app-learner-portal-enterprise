import {
  TaxonomyFacetBootstrap,
  AIPathwaysResponseModel,
  CareerOption,
  LearnerProfile,
} from './types';

export const mockIntakeInput = {
  bringsYouHereRes: 'I want to transition into software engineering',
  careerGoalRes: 'Become a Full Stack Developer',
  backgroundRes: 'Some basic HTML/CSS knowledge',
  industryRes: 'Technology',
  learningPrefRes: 'Hands-on projects',
  timeAvailableRes: '10 hours per week',
  certificateRes: 'Yes',
};

export const mockSearchIntent = {
  condensedQuery: 'software engineering',
  roles: ['Software Engineer', 'Full Stack Developer'],
  skillsRequired: ['JavaScript', 'React', 'Node.js'],
  skillsPreferred: ['TypeScript', 'SQL'],
  queryTerms: ['full stack', 'web development'],
  excludeTags: [],
  timeCommitment: 'medium',
};

export const mockTaxonomyUniverse: TaxonomyFacetBootstrap = {
  'skills.name': {
    items: [
      {
        label: 'JavaScript', value: 'JavaScript', count: 120, isRefined: false,
      },
      {
        label: 'React', value: 'React', count: 85, isRefined: false,
      },
      {
        label: 'Python', value: 'Python', count: 90, isRefined: false,
      },
      {
        label: 'Node.js', value: 'Node.js', count: 50, isRefined: false,
      },
    ],
  },
  industry_names: {
    items: [
      {
        label: 'Technology', value: 'Technology', count: 100, isRefined: false,
      },
      {
        label: 'Finance', value: 'Finance', count: 30, isRefined: false,
      },
    ],
  },
  job_sources: {
    items: [
      {
        label: 'Software Engineer', value: 'Software Engineer', count: 50, isRefined: false,
      },
      {
        label: 'Full Stack Developer', value: 'Full Stack Developer', count: 20, isRefined: false,
      },
    ],
  },
  name: {
    items: [],
  },
};

export const mockMatchedSelections = {
  'skills.name': ['JavaScript', 'React', 'Node.js'],
  industry_names: ['Technology'],
  job_sources: ['Software Engineer', 'Full Stack Developer'],
};

export const mockRefinedHits = [
  {
    id: 'course-1',
    title: 'Modern React with Redux',
    description: 'Master React and Redux',
    skills: ['React', 'JavaScript'],
    industry_names: ['Technology'],
  },
  {
    id: 'course-2',
    title: 'Node.js Complete Guide',
    description: 'Learn Node.js from scratch',
    skills: ['Node.js', 'JavaScript'],
    industry_names: ['Technology'],
  },
];

export const mockCareerOption: CareerOption = {
  title: 'Software Engineer',
  skills: ['JavaScript', 'React'],
  percentMatch: 0.92,
  industries: ['Technology'],
  jobSources: ['Software Engineer'],
};

export const mockLearnerProfile: LearnerProfile = {
  overview: 'Targeting roles like Software Engineer, Full Stack Developer.',
  careerGoal: 'Become a Full Stack Developer',
  targetIndustry: 'Technology',
  background: 'Some basic HTML/CSS knowledge',
  motivation: 'I want to transition into software engineering',
  learningStyle: 'Hands-on projects',
  timeAvailable: '10 hours per week',
  certificate: 'Yes',
  careerMatches: [mockCareerOption],
};

export const mockPathwayResponse: AIPathwaysResponseModel = {
  requestId: 'test-request-id',
  stages: {
    intentExtraction: {
      durationMs: 450,
      success: true,
      systemPrompt: 'You are an AI career advisor...',
      rawResponse: '{"condensedQuery": "software engineering"}',
      parsedResponse: mockSearchIntent,
      validationErrors: [],
      repairPromptUsed: false,
    },
    careerRetrieval: { durationMs: 120, success: true, resultCount: 2 },
    courseRetrieval: { durationMs: 210, success: true, resultCount: 2 },
    pathwayEnrichment: {
      durationMs: 800,
      success: true,
      systemPrompt: 'You are a curriculum designer...',
      rawResponse: '{"courses": []}',
    },
  },
};
