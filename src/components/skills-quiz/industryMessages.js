import { defineMessages } from '@edx/frontend-platform/i18n';

const industryMessages = defineMessages({
  industryLabel: {
    id: 'enterprise.skills.quiz.industry.label',
    defaultMessage: 'Industry I belong to',
    description: 'Label and default title for the industry filter dropdown in the skills quiz.',
  },
  industrySearchPlaceholder: {
    id: 'enterprise.skills.quiz.industry.searchPlaceholder',
    defaultMessage: 'Find an industry...',
    description: 'Placeholder for the search input inside the industry filter dropdown in the skills quiz.',
  },
  industrySearchAriaLabel: {
    id: 'enterprise.skills.quiz.industry.searchAriaLabel',
    defaultMessage: 'Type to find an industry',
    description: 'Accessible label for the search input inside the industry filter dropdown in the skills quiz.',
  },
});

export default industryMessages;
