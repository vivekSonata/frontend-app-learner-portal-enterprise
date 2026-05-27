/**
 * Sanitizes an array of tags for use in Xpert Platform requests.
 *
 * Rules:
 * - trim whitespace
 * - remove empty strings
 * - de-duplicate (preserve order)
 * - return undefined if result is empty
 *
 * @param tags Array of raw tag strings.
 * @returns Sanitized array of tags or undefined if empty.
 */
export function sanitizeTags(tags?: string[]): string[] | undefined {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const sanitized = Array.from(new Set(
    tags
      .map(tag => tag.trim())
      .filter(tag => tag !== ''),
  ));

  return sanitized.length > 0 ? sanitized : undefined;
}
