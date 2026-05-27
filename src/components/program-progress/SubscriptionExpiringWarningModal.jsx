import PropTypes from 'prop-types';
import {
  ActionRow, Button, MailtoLink, StandardModal,
} from '@openedx/paragon';
import {
  defineMessages, FormattedMessage, useIntl,
} from '@edx/frontend-platform/i18n';
import { SUBSCRIPTION_EXPIRING_MODAL_TITLE } from './data/constants';
import { useEnterpriseCustomer, useSubscriptions } from '../app/data';
import { i18nFormatTimestamp } from '../../utils/common';

const messages = defineMessages({
  contactLearningManager: {
    id: 'enterprise.program.progress.subscription.warning.contact.learning.manager',
    defaultMessage: 'contact your learning manager',
    description: 'Link text for the contact action in the subscription expiration warning modal.',
  },
  subscriptionWillExpire: {
    id: 'enterprise.program.progress.subscription.warning.body.expiration',
    defaultMessage: 'Your edX subscription access through [{enterpriseName}] will expire before you are projected to complete all of the courses in the program (based on course end dates). If you are not able to complete all of the courses in the program before your access expires, you will not be eligible to view or share your program record.',
    description: 'Primary explanation in the subscription expiration warning modal.',
  },
  renewalNotice: {
    id: 'enterprise.program.progress.subscription.warning.body.renewal.notice',
    defaultMessage: 'If you plan to complete the program, please {contactLink} to ensure your subscription access is renewed.',
    description: 'Renewal guidance shown in the subscription expiration warning modal. The contactLink placeholder should render a link or plain text directing the learner to contact their learning manager.',
  },
  accessExpires: {
    id: 'enterprise.program.progress.subscription.warning.access.expires',
    defaultMessage: 'Access expires: {expirationDate}.',
    description: 'Expiration date label in the subscription expiration warning modal.',
  },
  acknowledge: {
    id: 'enterprise.program.progress.subscription.warning.acknowledge',
    defaultMessage: 'OK',
    description: 'Confirmation button label in the subscription expiration warning modal.',
  },
});

const SubscriptionExpirationWarningModal = ({
  isSubscriptionExpiringWarningModalOpen,
  onSubscriptionExpiringWarningModalClose,
}) => {
  const intl = useIntl();
  const { data: enterpriseCustomer } = useEnterpriseCustomer();
  const { data: { subscriptionPlan } } = useSubscriptions();
  const modalTitle = intl.formatMessage(SUBSCRIPTION_EXPIRING_MODAL_TITLE);
  const contactLearningManagerText = intl.formatMessage(messages.contactLearningManager);
  const contactLink = enterpriseCustomer.contactEmail
    ? <MailtoLink to={enterpriseCustomer.contactEmail} className="font-weight-bold">{contactLearningManagerText}</MailtoLink>
    : contactLearningManagerText;

  const renderExpiredBody = () => (
    <>
      <p>
        <FormattedMessage
          id={messages.subscriptionWillExpire.id}
          defaultMessage={messages.subscriptionWillExpire.defaultMessage}
          description={messages.subscriptionWillExpire.description}
          values={{
            enterpriseName: enterpriseCustomer.name,
          }}
        />
      </p>
      <p>
        <FormattedMessage
          id={messages.renewalNotice.id}
          defaultMessage={messages.renewalNotice.defaultMessage}
          description={messages.renewalNotice.description}
          values={{ contactLink }}
        />
      </p>
      <i>
        <FormattedMessage
          id={messages.accessExpires.id}
          defaultMessage={messages.accessExpires.defaultMessage}
          description={messages.accessExpires.description}
          values={{
            expirationDate: i18nFormatTimestamp({ intl, timestamp: subscriptionPlan.expirationDate }),
          }}
        />
      </i>
    </>
  );

  return (
    <StandardModal
      title={modalTitle}
      isOpen={isSubscriptionExpiringWarningModalOpen}
      hasCloseButton={false}
      isOverflowVisible={false}
      onClose={onSubscriptionExpiringWarningModalClose}
      footerNode={(
        <ActionRow>
          <Button onClick={onSubscriptionExpiringWarningModalClose}>
            <FormattedMessage
              id={messages.acknowledge.id}
              defaultMessage={messages.acknowledge.defaultMessage}
              description={messages.acknowledge.description}
            />
          </Button>
        </ActionRow>
      )}
    >
      {renderExpiredBody()}
    </StandardModal>
  );
};
SubscriptionExpirationWarningModal.propTypes = {
  isSubscriptionExpiringWarningModalOpen: PropTypes.bool.isRequired,
  onSubscriptionExpiringWarningModalClose: PropTypes.func.isRequired,
};
export default SubscriptionExpirationWarningModal;
