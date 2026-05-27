import { sanitizeTags } from '../tagUtils';

describe('sanitizeTags', () => {
  it('trims whitespace', () => {
    expect(sanitizeTags([' discovery ', ' edx-available-course '])).toEqual(['discovery', 'edx-available-course']);
  });

  it('removes empty strings', () => {
    expect(sanitizeTags(['discovery', '', ' ', 'edx-available-course'])).toEqual(['discovery', 'edx-available-course']);
  });

  it('de-duplicates tags while preserving order', () => {
    expect(sanitizeTags(['discovery', 'edx-available-course', 'discovery'])).toEqual(['discovery', 'edx-available-course']);
  });

  it('returns undefined if result is empty', () => {
    expect(sanitizeTags(['', ' ', '  '])).toBeUndefined();
    expect(sanitizeTags([])).toBeUndefined();
    expect(sanitizeTags(undefined)).toBeUndefined();
  });

  it('handles mixed cases as specified in example', () => {
    const input = [' discovery ', '', 'edx-available-course', 'discovery'];
    const output = ['discovery', 'edx-available-course'];
    expect(sanitizeTags(input)).toEqual(output);
  });
});
