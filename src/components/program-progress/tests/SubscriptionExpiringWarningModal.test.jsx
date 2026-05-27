import PropTypes from 'prop-types';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SubscriptionExpirationWarningModal from '../SubscriptionExpiringWarningModal';
import { useEnterpriseCustomer, useSubscriptions } from '../../app/data';

jest.mock('../../app/data', () => ({
  ...jest.requireActual('../../app/data'),
  useEnterpriseCustomer: jest.fn(),
  useSubscriptions: jest.fn(),
}));

const defaultEnterpriseCustomer = {
  name: 'Demo Enterprise',
  contactEmail: 'manager@example.com',
};

const defaultSubscriptions = {
  subscriptionPlan: {
    expirationDate: '2026-12-15T00:00:00Z',
  },
};

const SubscriptionExpiringWarningModalWrapper = ({
  isSubscriptionExpiringWarningModalOpen = true,
  onSubscriptionExpiringWarningModalClose = jest.fn(),
}) => (
  <IntlProvider locale="en">
    <SubscriptionExpirationWarningModal
      isSubscriptionExpiringWarningModalOpen={isSubscriptionExpiringWarningModalOpen}
      onSubscriptionExpiringWarningModalClose={onSubscriptionExpiringWarningModalClose}
    />
  </IntlProvider>
);

SubscriptionExpiringWarningModalWrapper.propTypes = {
  isSubscriptionExpiringWarningModalOpen: PropTypes.bool,
  onSubscriptionExpiringWarningModalClose: PropTypes.func,
};

describe('<SubscriptionExpirationWarningModal />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEnterpriseCustomer.mockReturnValue({ data: defaultEnterpriseCustomer });
    useSubscriptions.mockReturnValue({ data: defaultSubscriptions });
  });

  it('renders a mailto contact link when enterprise contact email exists', () => {
    render(<SubscriptionExpiringWarningModalWrapper />);

    expect(screen.getByText('Your subscription access expires before the program will finish')).toBeInTheDocument();
    expect(screen.getByText(/Your edX subscription access through/i)).toBeInTheDocument();

    const contactLink = screen.getByRole('link', { name: 'contact your learning manager' });
    expect(contactLink).toHaveAttribute('href', 'mailto:manager@example.com');

    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('renders plain contact text when enterprise contact email is not set', () => {
    useEnterpriseCustomer.mockReturnValue({
      data: {
        ...defaultEnterpriseCustomer,
        contactEmail: null,
      },
    });

    render(<SubscriptionExpiringWarningModalWrapper />);

    expect(screen.getByText(/please\s+contact your learning manager\s+to ensure your subscription access is renewed\./i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'contact your learning manager' })).not.toBeInTheDocument();
  });

  it('calls close handler when the OK button is clicked', () => {
    const onClose = jest.fn();

    render(
      <SubscriptionExpiringWarningModalWrapper
        onSubscriptionExpiringWarningModalClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
