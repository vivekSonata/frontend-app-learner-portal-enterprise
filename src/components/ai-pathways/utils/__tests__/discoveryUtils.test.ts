import { mergeTags, mergeDiscovery } from '../discoveryUtils';

describe('discoveryUtils', () => {
  describe('mergeTags', () => {
    it('should merge and unique tags', () => {
      const existing = ['tag1', 'tag2'];
      const next = ['tag2', 'tag3'];
      expect(mergeTags(existing, next)).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle undefined values', () => {
      expect(mergeTags(undefined, ['tag1'])).toEqual(['tag1']);
      expect(mergeTags(['tag1'], undefined)).toEqual(['tag1']);
      expect(mergeTags(undefined, undefined)).toBeUndefined();
    });
  });

  describe('mergeDiscovery', () => {
    it('should merge objects and concatenate documents', () => {
      const existing = {
        query: 'query1',
        documents: [{ id: '1', text: 'doc1' }],
      };
      const next = {
        query: 'query2',
        documents: [{ id: '2', text: 'doc2' }],
      };
      const merged = mergeDiscovery(existing, next);
      expect(merged.query).toBe('query2');
      expect(merged.documents).toHaveLength(2);
      expect(merged.documents).toEqual([
        { id: '1', text: 'doc1' },
        { id: '2', text: 'doc2' },
      ]);
    });

    it('should de-duplicate documents by id', () => {
      const existing = {
        documents: [{ id: '1', text: 'doc1' }],
      };
      const next = {
        documents: [{ id: '1', text: 'doc1' }, { id: '2', text: 'doc2' }],
      };
      const merged = mergeDiscovery(existing, next);
      expect(merged.documents).toHaveLength(2);
      expect(merged.documents[0].id).toBe('1');
      expect(merged.documents[1].id).toBe('2');
    });

    it('should handle missing documents array', () => {
      const existing = { query: 'q1' };
      const next = { documents: [{ id: '1' }] };
      expect(mergeDiscovery(existing, next)).toEqual({
        query: 'q1',
        documents: [{ id: '1' }],
      });
    });

    it('should handle undefined next', () => {
      const existing = { query: 'q1' };
      expect(mergeDiscovery(existing, undefined)).toEqual(existing);
    });
  });
});
