import { sanitizeTags } from './tagUtils';

/**
 * Combines two Xpert RAG tag arrays into a single de-duplicated, sanitized list.
 * Used when merging tag arrays across multiple Xpert calls (intent extraction + enrichment)
 * so that the consolidated set can be attached to the debug trace.
 *
 * @param existing The tag array from the prior call, if any.
 * @param next The tag array from the latest call, if any.
 * @returns A sanitized, de-duplicated tag array, or `undefined` if both inputs are empty.
 */
export function mergeTags(existing?: string[], next?: string[]): string[] | undefined {
  return sanitizeTags([...(existing || []), ...(next || [])]);
}

/**
 * Deep-merges two Xpert RAG discovery objects, concatenating and de-duplicating the
 * `documents` arrays by `id` when both objects contain them.
 * Used to accumulate discovery context across multiple Xpert calls on the same pathway.
 *
 * @param existing The discovery object from the prior call, or `undefined`.
 * @param next The discovery object from the latest call, or `undefined`.
 * @returns A merged discovery object, preferring `next` for non-array fields, and
 *   combining `documents` arrays with de-duplication by `id`.
 */
export function mergeDiscovery(existing: any, next: any): any {
  if (!next) {
    return existing;
  }
  if (!existing) {
    return next;
  }

  const merged = { ...existing, ...next };

  if (Array.isArray(existing.documents) && Array.isArray(next.documents)) {
    // Combine documents from both discoveries
    merged.documents = [...existing.documents, ...next.documents];

    // Optional: unique by id if present
    const seenIds = new Set();
    merged.documents = merged.documents.filter((doc: any) => {
      if (!doc.id) {
        return true;
      }
      if (seenIds.has(doc.id)) {
        return false;
      }
      seenIds.add(doc.id);
      return true;
    });
  }

  return merged;
}
