import {
  useCallback, useRef, useState, useEffect,
} from 'react';
import PropTypes from 'prop-types';
import { useIntl } from '@edx/frontend-platform/i18n';
import { appendProgramToProgramType } from './data/utils';
import { useProgramDetails } from '../app/data';

const ProgramDataBarDetails = ({ handleStick, handleRelease }) => {
  const intl = useIntl();
  const {
    data: {
      title, authoringOrganizations: owners, type,
    },
  } = useProgramDetails();
  const wrapper = useRef(null);
  const [sticky, setSticky] = useState(false);
  const [componentTop, setComponentTop] = useState(0);

  const getOffsetTop = () => {
    /**
     * returns top positon of div being refrenced by adding how much div is away from current visible top and
     * how much window have been scrolled
     */
    if (wrapper?.current) {
      const rect = wrapper.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      return rect.top + scrollTop;
    }

    return 1;
  };

  const handleScroll = useCallback(() => {
    const windowPosition = window.scrollY; // how much window have been scrolled vertically
    const wrapperTop = getOffsetTop(); // the top position(pixel no) of data bar
    if (!sticky) {
      // if data bar isnt sticky yet
      if (windowPosition >= wrapperTop) {
        // see that if window have been scrolled more than top of the data bar, stick the data bar
        setSticky(() => true);
        setComponentTop(() => wrapperTop); // save the top of data bar
        handleStick();
      }
    }
    if (windowPosition === 0 || (windowPosition + 30) < componentTop) {
      // see if the window have no scroll or windows scroll have reaced above the top of component by 30px, unstick it
      setSticky(() => false);
      handleRelease();
    }
  }, [componentTop, handleRelease, handleStick, sticky]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const partnerList = owners.map(owner => owner.key).join(',');
  return (
    <div ref={wrapper} className="program">
      <div className="type">
        {appendProgramToProgramType(type, intl)} {intl.formatMessage({
          id: 'enterprise.program.data.bar.details.in',
          defaultMessage: 'in',
          description: 'Connector between the program type and title in the sticky program data bar.',
        })} <div className="title">{title}</div>
      </div>
      <div className="institution">{partnerList}</div>
    </div>
  );
};

ProgramDataBarDetails.propTypes = {
  handleStick: PropTypes.func.isRequired,
  handleRelease: PropTypes.func.isRequired,
};

export default ProgramDataBarDetails;
