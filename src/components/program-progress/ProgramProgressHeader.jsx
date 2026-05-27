import { v4 as uuidv4 } from 'uuid';
import { FormattedMessage, useIntl } from '@edx/frontend-platform/i18n';
import { getProgramIcon } from './data/utils';
import { useLearnerProgramProgressData } from '../app/data';

const ProgramProgressHeader = () => {
  const { data: { programData } } = useLearnerProgramProgressData();
  const programIcon = getProgramIcon(programData.type);
  const intl = useIntl();

  return (
    <div className="program-details-header">
      <div className="meta-info grid-container">
        {programIcon && (
          <img
            src={programIcon}
            alt={intl.formatMessage({
              id: 'enterprise.dashboard.program.progress.header.program.type.logo.alt',
              defaultMessage: 'Program type logo',
              description: 'Alt text for the icon representing the program type on the program progress header',
            })}
            className={`program-details-icon ${programData.type.toLowerCase()}`}
          />
        )}
        <h2 className="hd-1 program-title">{programData.title}</h2>
      </div>
      <div className="authoring-organizations">
        <h2 className="heading">
          <FormattedMessage
            id="enterprise.dashboard.program.progress.header.institutions"
            defaultMessage="Institutions"
            description="Heading for the authoring organizations section on the program progress header"
          />
        </h2>
        {programData.authoringOrganizations.length > 0 && (
          <div className="orgs">
            {programData.authoringOrganizations.map(org => (
              <img
                key={uuidv4()}
                id="org-image"
                src={org.certificateLogoImageUrl || org.logoImageUrl}
                className="org-logo"
                alt={intl.formatMessage(
                  {
                    id: 'enterprise.dashboard.program.progress.header.organization.logo.alt',
                    defaultMessage: '{organizationName} logo',
                    description: 'Alt text for an authoring organization logo shown on the program progress header',
                  },
                  { organizationName: org.name },
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramProgressHeader;
