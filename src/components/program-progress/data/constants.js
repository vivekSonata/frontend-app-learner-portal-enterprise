import { defineMessages } from '@edx/frontend-platform/i18n';

// ProgramProgressCircle constants
export const X_AXIS = 22;
export const Y_AXIS = 22;
export const CIRCLE_RADIUS = 16;
export const CIRCLE_DEGREES = 180;
export const STROKE_WIDTH = 1.2;

const programProgressMessages = defineMessages({
  subscriptionExpiringModalTitle: {
    id: 'enterprise.program.progress.subscription.warning.title',
    defaultMessage: 'Your subscription access expires before the program will finish',
    description: 'Title for the subscription expiration warning modal on the program progress page.',
  },
});

export const SUBSCRIPTION_EXPIRING_MODAL_TITLE = programProgressMessages.subscriptionExpiringModalTitle;
