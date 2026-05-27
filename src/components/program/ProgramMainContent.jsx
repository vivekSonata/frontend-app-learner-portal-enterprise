import { FormattedMessage, useIntl } from '@edx/frontend-platform/i18n';
import ProgramInstructors from './ProgramInstructors';
import ProgramCourses from './ProgramCourses';
import { PreviewExpand } from '../preview-expand';
import BulletList from './BulletList';
import { useProgramDetails } from '../app/data';

const ProgramMainContent = () => {
  const { data: program } = useProgramDetails();
  const { expectedLearningItems, overview } = program;
  const intl = useIntl();
  return (
    <div className="program-main-content">
      {expectedLearningItems && expectedLearningItems.length > 0 && (
        <PreviewExpand
          className="mb-5"
          cta={{
            labelToExpand: intl.formatMessage({
              id: 'enterprise.program.main.what.youll.learn.expand',
              defaultMessage: "Expand what you'll learn",
              description: 'Button label to expand the What you will learn section on the program detail page',
            }),
            labelToMinimize: intl.formatMessage({
              id: 'enterprise.program.main.what.youll.learn.collapse',
              defaultMessage: "Collapse what you'll learn",
              description: 'Button label to collapse the What you will learn section on the program detail page',
            }),
            id: 'what-youll-learn',
          }}
          heading={(
            <h3>
              <FormattedMessage
                id="enterprise.program.main.what.youll.learn.heading"
                defaultMessage="What you'll learn"
                description="Heading for the What you will learn section on the program detail page"
              />
            </h3>
          )}
        >
          <div><BulletList items={expectedLearningItems} /></div>
        </PreviewExpand>
      )}
      {overview && (
        <PreviewExpand
          className="mb-5"
          cta={{
            labelToExpand: intl.formatMessage({
              id: 'enterprise.program.main.about.expand',
              defaultMessage: 'More about this program',
              description: 'Button label to expand the About this program section on the program detail page',
            }),
            labelToMinimize: intl.formatMessage({
              id: 'enterprise.program.main.about.collapse',
              defaultMessage: 'Collapse about this program',
              description: 'Button label to collapse the About this program section on the program detail page',
            }),
            id: 'about-this-course',
          }}
          heading={(
            <h3>
              <FormattedMessage
                id="enterprise.program.main.about.heading"
                defaultMessage="About this program"
                description="Heading for the About this program section on the program detail page"
              />
            </h3>
          )}
        >
          {/* eslint-disable-next-line react/no-danger */}
          <div dangerouslySetInnerHTML={{ __html: overview }} />
        </PreviewExpand>
      )}
      <ProgramCourses />
      <ProgramInstructors />
    </div>
  );
};

export default ProgramMainContent;
