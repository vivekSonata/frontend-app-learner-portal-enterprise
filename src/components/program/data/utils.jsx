import { defineMessages } from '@edx/frontend-platform/i18n';
import {
  PROGRAM_TYPE_MAP, PROGRAM_PACING_MAP, PACING_TYPE_CONTENT, VERBOSE_PROGRAM_PACING_MAP,
} from './constants';

const messages = defineMessages({
  graduateLevelCourses: {
    id: 'enterprise.program.sidebar.expert.instruction.graduate.level.courses',
    defaultMessage: '{courseCount, plural, one {# graduate-level course} other {# graduate-level courses}}',
    description: 'Expert instruction supporting text for MicroMasters programs.',
  },
  skillBuildingCourses: {
    id: 'enterprise.program.sidebar.expert.instruction.skill.building.courses',
    defaultMessage: '{courseCount, plural, one {# skill-building course} other {# skill-building courses}}',
    description: 'Expert instruction supporting text for professional certificate programs.',
  },
  highQualityCourses: {
    id: 'enterprise.program.sidebar.expert.instruction.high.quality.courses',
    defaultMessage: '{courseCount, plural, one {# high-quality course} other {# high-quality courses}}',
    description: 'Expert instruction supporting text for other program types.',
  },
  hoursPerWeekSingleValue: {
    id: 'enterprise.program.sidebar.effort.single.value',
    defaultMessage: '{hours} hours per week',
    description: 'Estimated effort per week with a single hourly value.',
  },
  hoursPerWeekRange: {
    id: 'enterprise.program.sidebar.effort.range',
    defaultMessage: '{minHours} - {maxHours} hours per week',
    description: 'Estimated effort per week with a range of hours.',
  },
  durationWeeks: {
    id: 'enterprise.program.duration.weeks',
    defaultMessage: '{count, plural, one {# week} other {# weeks}}',
    description: 'Program duration expressed in weeks.',
  },
  durationMonths: {
    id: 'enterprise.program.duration.months',
    defaultMessage: '{count, plural, one {# month} other {# months}}',
    description: 'Program duration expressed in months.',
  },
  durationYears: {
    id: 'enterprise.program.duration.years',
    defaultMessage: '{count, plural, one {# year} other {# years}}',
    description: 'Program duration expressed in years.',
  },
  durationYearsAndMonths: {
    id: 'enterprise.program.duration.years.and.months',
    defaultMessage: '{years, plural, one {# year} other {# years}} {months, plural, one {# month} other {# months}}',
    description: 'Program duration expressed in years and months.',
  },
  programSuffix: {
    id: 'enterprise.program.type.suffix.program',
    defaultMessage: 'Program',
    description: 'Suffix appended to certain program types.',
  },
  mastersDegree: {
    id: 'enterprise.program.type.masters.degree',
    defaultMessage: "Master's Degree",
    description: 'Display label for masters degree programs.',
  },
  professionalCertificate: {
    id: 'enterprise.program.type.professional.certificate',
    defaultMessage: 'Professional Certificate',
    description: 'Localized label for the Professional Certificate program type',
  },
});

function formatMessageWithFallback(intl, message, values = {}) {
  if (intl) {
    return intl.formatMessage(message, values);
  }

  return message.defaultMessage;
}

function formatCountString(intl, singularNoun, pluralNoun, count, message) {
  if (intl) {
    return intl.formatMessage(message, { count, courseCount: count });
  }
  return `${count} ${count === 1 ? singularNoun : pluralNoun}`;
}

export function getProgramPacing(program) {
  const { courses } = program;
  const coursePacings = courses.map((course) => {
    if (course.activeCourseRun) {
      return course.activeCourseRun.pacingType;
    }
    return false;
  });

  // Set removes duplicates
  const uniquePacings = new Set(coursePacings);

  if (uniquePacings.size === 1) {
    return coursePacings[0];
  }

  return PROGRAM_PACING_MAP.MIXED;
}

export function getVerboseProgramPacing(pacing, intl) {
  const message = VERBOSE_PROGRAM_PACING_MAP[pacing];
  if (!message) {
    return undefined;
  }
  return formatMessageWithFallback(intl, message);
}

export function programIsMicroMasters(program) {
  const { type } = program;
  return type === PROGRAM_TYPE_MAP.MICROMASTERS;
}

export function programIsProfessionalCertificate(program) {
  const { type } = program;
  return type === PROGRAM_TYPE_MAP.PROFESSIONAL_CERTIFICATE;
}

export function getProgramPacingTypeContent(PacingType, intl) {
  if (PacingType === PROGRAM_PACING_MAP.INSTRUCTOR_PACED) {
    return formatMessageWithFallback(intl, PACING_TYPE_CONTENT.INSTRUCTOR_PACED);
  }
  if (PacingType === PROGRAM_PACING_MAP.SELF_PACED) {
    return formatMessageWithFallback(intl, PACING_TYPE_CONTENT.SELF_PACED);
  }
  return undefined;
}

export function getExpertInstructionSecondaryContent(program, intl) {
  const { courses } = program;
  const courseCount = courses.length;
  if (programIsMicroMasters(program)) {
    return formatCountString(intl, 'graduate-level course', 'graduate-level courses', courseCount, messages.graduateLevelCourses);
  }
  if (programIsProfessionalCertificate(program)) {
    return formatCountString(intl, 'skill-building course', 'skill-building courses', courseCount, messages.skillBuildingCourses);
  }
  return formatCountString(intl, 'high-quality course', 'high-quality courses', courseCount, messages.highQualityCourses);
}

export function getTotalWeeks(program) {
  const { courses } = program;
  const reducer = (totalWeeks, course) => {
    let additionalWeeks = 0;
    if (course.activeCourseRun && course.activeCourseRun.weeksToComplete) {
      additionalWeeks = Number.parseInt(course.activeCourseRun.weeksToComplete, 10);
    }
    return totalWeeks + additionalWeeks;
  };
  return Number.parseInt(courses.reduce(reducer, 0), 10);
}

export function getTotalEstimatedEffortInHoursPerWeek(program, intl) {
  const minTotalHours = program.minHoursEffortPerWeek;
  const maxTotalHours = program.maxHoursEffortPerWeek;

  if (minTotalHours === null || maxTotalHours == null) {
    return null;
  }

  if (minTotalHours === maxTotalHours) {
    if (intl) {
      return intl.formatMessage(messages.hoursPerWeekSingleValue, { hours: minTotalHours });
    }
    return `${minTotalHours} hours per week`;
  }
  if (intl) {
    return intl.formatMessage(messages.hoursPerWeekRange, { minHours: minTotalHours, maxHours: maxTotalHours });
  }
  return `${minTotalHours} - ${maxTotalHours} hours per week`;
}

export function getProgramDuration(program, intl) {
  const totalWeeks = getTotalWeeks(program);
  if (!totalWeeks) {
    return null;
  }

  if (totalWeeks < 4) {
    if (intl) {
      return intl.formatMessage(messages.durationWeeks, { count: totalWeeks });
    }
    return `${totalWeeks} ${totalWeeks === 1 ? 'week' : 'weeks'}`;
  }

  const totalMonths = Math.round(totalWeeks / 4);
  if (totalMonths < 12) {
    if (intl) {
      return intl.formatMessage(messages.durationMonths, { count: totalMonths });
    }
    return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`;
  }

  const totalYears = Math.floor(totalMonths / 12);
  const totalRemainderMonths = Math.round(totalMonths % 12);

  if (totalRemainderMonths === 0) {
    if (intl) {
      return intl.formatMessage(messages.durationYears, { count: totalYears });
    }
    return `${totalYears} ${totalYears === 1 ? 'year' : 'years'}`;
  }

  if (intl) {
    return intl.formatMessage(messages.durationYearsAndMonths, {
      years: totalYears,
      months: totalRemainderMonths,
    });
  }

  return `${totalYears} ${totalYears === 1 ? 'year' : 'years'} ${totalRemainderMonths} ${totalRemainderMonths === 1 ? 'month' : 'months'}`;
}

export function appendProgramToProgramType(programType, intl) {
  switch (programType.toLowerCase()) {
    case 'micromasters':
    case 'xseries':
    case 'microbachelors':
      return <span> {programType}<sup>®</sup> {formatMessageWithFallback(intl, messages.programSuffix)} </span>;
    case 'masters':
      return formatMessageWithFallback(intl, messages.mastersDegree);
    case 'professional_certificate':
      return formatMessageWithFallback(intl, messages.professionalCertificate);
    default:
      return programType;
  }
}
