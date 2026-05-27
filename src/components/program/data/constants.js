import { defineMessages } from '@edx/frontend-platform/i18n';

export const PROGRAM_TYPE_MAP = {
  MICROMASTERS: 'MicroMasters',
  CREDIT: 'Credit',
  XSERIES: 'XSeries',
  PROFESSIONAL_CERTIFICATE: 'Professional Certificate',
  MICROBACHELORS: 'MicroBachelors',
  MASTERS: 'Masters',
};

export const PROGRAM_PACING_MAP = {
  SELF_PACED: 'self_paced',
  INSTRUCTOR_PACED: 'instructor_paced',
  MIXED: 'mixed',
};

export const VERBOSE_PROGRAM_PACING_MAP = defineMessages({
  self_paced: {
    id: 'enterprise.program.sidebar.pacing.self.paced',
    defaultMessage: 'Self-paced',
    description: 'Program pacing label for self-paced programs.',
  },
  instructor_paced: {
    id: 'enterprise.program.sidebar.pacing.instructor.led',
    defaultMessage: 'Instructor-led',
    description: 'Program pacing label for instructor-led programs.',
  },
});

export const PACING_TYPE_CONTENT = defineMessages({
  SELF_PACED: {
    id: 'enterprise.program.sidebar.pacing.content.self.paced',
    defaultMessage: 'Progress at your own speed',
    description: 'Supporting text for self-paced programs in the sidebar.',
  },
  INSTRUCTOR_PACED: {
    id: 'enterprise.program.sidebar.pacing.content.instructor.paced',
    defaultMessage: 'Assignments and exams have specific due dates',
    description: 'Supporting text for instructor-led programs in the sidebar.',
  },
});

const programNotFoundMessages = defineMessages({
  title: {
    id: 'enterprise.program.not.found.title',
    defaultMessage: 'Program not found',
    description: 'Title shown when the requested program is not in the enterprise catalog.',
  },
  message: {
    id: 'enterprise.program.not.found.message',
    defaultMessage: "This program is not included in your organization's catalog.",
    description: 'Explanation shown when the requested program is not in the enterprise catalog.',
  },
});

export const PROGRAM_NOT_FOUND_TITLE = programNotFoundMessages.title;
export const PROGRAM_NOT_FOUND_MESSAGE = programNotFoundMessages.message;
