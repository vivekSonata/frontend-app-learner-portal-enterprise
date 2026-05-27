import PropTypes from 'prop-types';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import CouponCodesWarningModal from '../CouponCodesWarningModal';
import { useEnterpriseCustomer } from '../../app/data';

jest.mock('../../app/data', () => ({
  ...jest.requireActual('../../app/data'),
  useEnterpriseCustomer: jest.fn(),
}));

const CouponCodesWarningModalWrapper = ({
  couponCodesCount = undefined,
  isCouponCodeWarningModalOpen = true,
  onCouponCodeWarningModalClose = jest.fn(),
}) => (
  <IntlProvider locale="en">
    <CouponCodesWarningModal
      couponCodesCount={couponCodesCount}
      isCouponCodeWarningModalOpen={isCouponCodeWarningModalOpen}
      onCouponCodeWarningModalClose={onCouponCodeWarningModalClose}
    />
  </IntlProvider>
);

CouponCodesWarningModalWrapper.propTypes = {
  couponCodesCount: PropTypes.number,
  isCouponCodeWarningModalOpen: PropTypes.bool,
  onCouponCodeWarningModalClose: PropTypes.func,
};

describe('<CouponCodesWarningModal />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the modal is closed', () => {
    useEnterpriseCustomer.mockReturnValue({ data: { contactEmail: 'admin@example.com' } });
    const { container } = render(
      <CouponCodesWarningModalWrapper isCouponCodeWarningModalOpen={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders plain contact text when no contact email is available', () => {
    useEnterpriseCustomer.mockReturnValue({ data: { contactEmail: null } });
    render(
      <CouponCodesWarningModalWrapper couponCodesCount={3} />,
    );
    expect(screen.getByText(/contact your learning manager/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'contact your learning manager' })).not.toBeInTheDocument();
    expect(screen.getByText('Codes remaining: 3')).toBeInTheDocument();
  });

  it('renders a mailto link and default coupon count when a contact email is available', () => {
    useEnterpriseCustomer.mockReturnValue({ data: { contactEmail: 'admin@example.com' } });
    render(
      <CouponCodesWarningModalWrapper />,
    );
    const contactLink = screen.getByRole('link', { name: 'contact your learning manager' });
    expect(contactLink).toHaveAttribute('href', 'mailto:admin@example.com');
    expect(screen.getByText('Codes remaining: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });
});
