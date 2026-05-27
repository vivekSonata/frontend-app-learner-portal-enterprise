import { useContext } from 'react';

import dayjs from 'dayjs';
import {
  Alert, Collapsible, Icon,
} from '@openedx/paragon';
import { FormattedMessage } from '@edx/frontend-platform/i18n';
import {
  CalendarMonth, ExpandLess, ExpandMore, LibraryBooks,
  WarningFilled,
} from '@openedx/paragon/icons';
import { AppContext } from '@edx/frontend-platform/react';
import { sendEnterpriseTrackEvent } from '@2uinc/frontend-enterprise-utils';
import { Link, useParams } from 'react-router-dom';

import { PROGRAM_PACING_MAP } from './data/constants';
import { useEnterpriseCustomer, useProgramDetails } from '../app/data';

export const DATE_FORMAT = 'MMM D, YYYY';

const getCourseRun = course => (
  // Get the latest course run.
  course.courseRuns?.sort(
    (a, b) => (dayjs(a.start) < dayjs(b.start) ? 1 : -1),
  )[0]
);

const ProgramCourses = () => {
  const { authenticatedUser: { userId } } = useContext(AppContext);
  const { data: enterpriseCustomer } = useEnterpriseCustomer();
  const { data: program } = useProgramDetails();
  const { programUuid } = useParams();

  return (
    <>
      <h2 className="h2 section-title pb-3">
        <FormattedMessage
          id="enterprise.program.courses.section.title"
          defaultMessage="Courses in this program"
          description="Section title for the list of courses included in a program detail page"
        />
      </h2>
      <div className="courses-in-program-wrapper ml-3 mb-5">
        {program.courses && program.courses.map((course) => {
          const courseRun = getCourseRun(course);
          return (
            <Collapsible.Advanced className="collapsible-card-lg" key={course.title}>
              <Collapsible.Trigger className="collapsible-trigger">
                <div className="marker"><Icon src={LibraryBooks} className="mr-2" /></div>
                <h4 className="h4 flex-grow-1">{course.title}</h4>
                <Collapsible.Visible whenClosed>
                  <Icon src={ExpandMore} className="mr-2" />
                </Collapsible.Visible>

                <Collapsible.Visible whenOpen>
                  <Icon src={ExpandLess} className="mr-2" />
                </Collapsible.Visible>
              </Collapsible.Trigger>

              <Collapsible.Body className="collapsible-body mt-3 ml-4.5">
                {
                  (courseRun?.pacingType === PROGRAM_PACING_MAP.INSTRUCTOR_PACED && courseRun.start)
                  && (
                    <div className="course-card-result mb-2 d-flex">
                      <Icon src={CalendarMonth} className="mr-2" />
                      <span className="font-weight-bold">
                        <FormattedMessage
                          id="enterprise.program.courses.course.start.date"
                          defaultMessage="Starts {startDate}"
                          description="Start date label shown for a course run on the program detail page"
                          values={{
                            startDate: dayjs(courseRun.start).format(DATE_FORMAT),
                          }}
                        />
                      </span>
                    </div>
                  )
                }

                {course.shortDescription && (
                  <div
                    className="font-weight-normal mb-4"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: course.shortDescription }}
                  />
                )}
                {course.enterpriseHasCourse ? (
                  <Link
                    isInline
                    to={`/${enterpriseCustomer.slug}/course/${course.key}`}
                    target="_blank"
                    showLaunchIcon={false}
                    onClick={() => {
                      sendEnterpriseTrackEvent(
                        enterpriseCustomer.uuid,
                        'edx.ui.enterprise.learner_portal.program.course.clicked',
                        {
                          userId,
                          programUuid,
                          courseKey: course.key,
                        },
                      );
                    }}
                    data-testid="view-the-course"
                  >
                    <FormattedMessage
                      id="enterprise.program.courses.view.course"
                      defaultMessage="View the course"
                      description="Link text to view a course from the program detail page"
                    />
                  </Link>
                ) : (
                  <Alert variant="warning" icon={WarningFilled}>
                    <FormattedMessage
                      id="enterprise.program.courses.not.in.catalog"
                      defaultMessage="This course is not included in your organization's catalog."
                      description="Warning shown when a course in a program is not included in the learner's enterprise catalog"
                    />
                  </Alert>
                )}
              </Collapsible.Body>
            </Collapsible.Advanced>
          );
        })}
      </div>
    </>
  );
};

export default ProgramCourses;
