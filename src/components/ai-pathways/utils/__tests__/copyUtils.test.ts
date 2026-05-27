import { formatCareersAsText } from '../copyUtils';
import { CareerOption } from '../../types';

describe('copyUtils', () => {
  describe('formatCareersAsText', () => {
    it('formats a list of careers correctly', () => {
      const careers: CareerOption[] = [
        { title: 'Software Engineer', percentMatch: 0.95, skills: ['JS', 'React'] },
        { title: 'Data Scientist', percentMatch: 0.824, skills: ['Python', 'SQL'] },
      ];
      const result = formatCareersAsText(careers);
      expect(result).toContain('[95% Match] Software Engineer');
      expect(result).toContain('Skills: JS, React');
      expect(result).toContain('[82% Match] Data Scientist');
      expect(result).toContain('Skills: Python, SQL');
    });

    it('handles careers with no skills', () => {
      const careers: CareerOption[] = [
        { title: 'Manager', percentMatch: 0.7, skills: [] },
      ];
      const result = formatCareersAsText(careers);
      expect(result).toContain('[70% Match] Manager');
      expect(result).toContain('Skills: No specific skills listed');
    });

    it('handles empty list', () => {
      expect(formatCareersAsText([])).toBe('No career matches found.');
      // @ts-ignore
      expect(formatCareersAsText(null)).toBe('No career matches found.');
    });
  });
});
