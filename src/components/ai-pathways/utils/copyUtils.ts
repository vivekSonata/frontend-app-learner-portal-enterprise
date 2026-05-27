import { CareerOption } from '../types';

/**
 * Formats a list of career options into a readable text format.
 *
 * @param careerMatches The list of career options to format.
 * @returns A formatted string containing careers and their associated skills.
 */
export const formatCareersAsText = (careerMatches: CareerOption[]): string => {
  if (!careerMatches || careerMatches.length === 0) {
    return 'No career matches found.';
  }

  return careerMatches
    .map((career) => {
      const skillsList = (career.skills && career.skills.length > 0)
        ? career.skills.join(', ')
        : 'No specific skills listed';
      const matchPercent = Math.round(career.percentMatch * 100);
      return `[${matchPercent}% Match] ${career.title}\nSkills: ${skillsList}\n`;
    })
    .join('\n');
};
