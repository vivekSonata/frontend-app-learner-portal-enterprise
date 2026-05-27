import {
  AccessTime, LibraryBooks, Person, Speed,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import ProgramSidebarListItem from './ProgramSidebarListItem';
import {
  getProgramPacing,
  getProgramPacingTypeContent,
  getExpertInstructionSecondaryContent,
  getProgramDuration,
  getTotalEstimatedEffortInHoursPerWeek,
  getVerboseProgramPacing,
} from './data/utils';
import { useProgramDetails } from '../app/data';

const ProgramSidebar = () => {
  const intl = useIntl();
  const { data: program } = useProgramDetails();
  const expertInstructionSecondaryContent = getExpertInstructionSecondaryContent(program, intl);
  const programPacingType = getProgramPacing(program);
  const verboseProgramPacingType = getVerboseProgramPacing(programPacingType, intl);
  const programPacingTypeContent = getProgramPacingTypeContent(programPacingType, intl);
  const programDuration = getProgramDuration(program, intl);
  const totalEstimatedEffortInHoursPerWeek = getTotalEstimatedEffortInHoursPerWeek(program, intl);

  return (
    <ul className="pl-0 mb-5 program-details-sidebar">
      <ProgramSidebarListItem
        icon={LibraryBooks}
        label={intl.formatMessage({
          id: 'enterprise.program.sidebar.expert.instruction.label',
          defaultMessage: 'Expert instruction',
          description: 'Label for the expert instruction row in the program sidebar.',
        })}
        content={expertInstructionSecondaryContent}
      />

      {
        verboseProgramPacingType && programPacingTypeContent && (
          <ProgramSidebarListItem
            icon={Person}
            label={verboseProgramPacingType}
            content={programPacingTypeContent}
          />
        )
      }
      {
        programDuration && (
          <ProgramSidebarListItem
            icon={AccessTime}
            label={intl.formatMessage({
              id: 'enterprise.program.sidebar.length.label',
              defaultMessage: 'Length',
              description: 'Label for the duration row in the program sidebar.',
            })}
            content={programDuration}
          />
        )
      }
      {
        totalEstimatedEffortInHoursPerWeek && (
          <ProgramSidebarListItem
            icon={Speed}
            label={intl.formatMessage({
              id: 'enterprise.program.sidebar.effort.label',
              defaultMessage: 'Effort',
              description: 'Label for the effort row in the program sidebar.',
            })}
            content={totalEstimatedEffortInHoursPerWeek}
          />
        )
      }
    </ul>
  );
};

export default ProgramSidebar;
