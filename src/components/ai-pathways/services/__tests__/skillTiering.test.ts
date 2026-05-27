import { isMalformedCompound, tierSkillSignal, tierAllSignals } from '../skillTiering';
import { SkillSignal } from '../../types';

describe('isMalformedCompound', () => {
  it('returns true for " & " separator', () => {
    expect(isMalformedCompound('AutomationSQL & Python')).toBe(true);
  });

  it('returns true for " + " separator', () => {
    expect(isMalformedCompound('React + Redux')).toBe(true);
  });

  it('returns false for normal skill names', () => {
    expect(isMalformedCompound('Cloud Computing')).toBe(false);
    expect(isMalformedCompound('Software Development')).toBe(false);
    expect(isMalformedCompound('Platform as a Service (PaaS)')).toBe(false);
  });
});

describe('tierSkillSignal', () => {
  it('classifies intent_required as broad_anchor with score 80', () => {
    const signal: SkillSignal = { name: 'Software Development', source: 'intent_required' };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('broad_anchor');
    expect(result.score).toBe(80);
    expect(result.reasons).toContain('source=intent_required');
  });

  it('classifies intent_preferred as narrow_signal with score 40', () => {
    const signal: SkillSignal = { name: 'Python', source: 'intent_preferred' };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('narrow_signal');
    expect(result.score).toBe(40);
    expect(result.reasons).toContain('source=intent_preferred');
  });

  it('classifies Software Product as narrow_signal', () => {
    const signal: SkillSignal = {
      name: 'Platform as a Service (PaaS)',
      source: 'career_taxonomy',
      typeName: 'Software Product',
      significance: 1080,
      uniquePostings: 5000,
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('narrow_signal');
    expect(result.reasons).toContain('lightcast-type=Software Product');
  });

  it('classifies Specialized Skill as narrow_signal', () => {
    const signal: SkillSignal = {
      name: 'Software Quality (SQA/SQC)',
      source: 'career_taxonomy',
      typeName: 'Specialized Skill',
      significance: 684,
      uniquePostings: 5000,
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('narrow_signal');
    expect(result.reasons).toContain('lightcast-type=Specialized Skill');
  });

  it('classifies Common Skill as role_differentiator', () => {
    const signal: SkillSignal = {
      name: 'Data Storage Technologies',
      source: 'career_taxonomy',
      typeName: 'Common Skill',
      significance: 1146,
      uniquePostings: 10000,
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('role_differentiator');
    expect(result.reasons).toContain('lightcast-type=Common Skill');
  });

  it('classifies Certification as role_differentiator', () => {
    const signal: SkillSignal = {
      name: 'AWS Certified Developer',
      source: 'career_taxonomy',
      typeName: 'Certification',
      significance: 800,
      uniquePostings: 3000,
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('role_differentiator');
    expect(result.reasons).toContain('lightcast-type=Certification');
  });

  it('falls back to role_differentiator when typeName is null/missing', () => {
    const signal: SkillSignal = {
      name: 'DevOps',
      source: 'career_taxonomy',
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('role_differentiator');
    expect(result.reasons).toContain('lightcast-type=unknown-fallback');
  });

  it('classifies malformed compound as noise regardless of source', () => {
    const signal: SkillSignal = {
      name: 'AutomationSQL & Python',
      source: 'career_taxonomy',
      typeName: 'Common Skill',
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('noise');
    expect(result.score).toBe(0);
    expect(result.reasons).toContain('malformed-compound');
  });

  it('demotes rare narrow_signal skills (uniquePostings < 50) to noise', () => {
    const signal: SkillSignal = {
      name: 'Azure Service Fabric',
      source: 'career_taxonomy',
      typeName: 'Software Product',
      significance: 100,
      uniquePostings: 10,
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('noise');
    expect(result.reasons).toContain('rare-skill-demoted');
  });

  it('does NOT demote narrow_signal with uniquePostings >= 50', () => {
    const signal: SkillSignal = {
      name: 'Azure Service Fabric',
      source: 'career_taxonomy',
      typeName: 'Software Product',
      significance: 1000,
      uniquePostings: 5000,
    };
    const result = tierSkillSignal(signal);
    expect(result.tier).toBe('narrow_signal');
  });

  it('adds significance bonus within tier (but does not change tier)', () => {
    const allSignals: SkillSignal[] = [
      { name: 'A', source: 'career_taxonomy', significance: 100 },
      { name: 'B', source: 'career_taxonomy', significance: 200 },
      { name: 'C', source: 'career_taxonomy', significance: 300 },
    ];
    const lowSig = tierSkillSignal(allSignals[0], allSignals);
    const highSig = tierSkillSignal(allSignals[2], allSignals);
    // Both should be same tier but high significance should score higher
    expect(highSig.score).toBeGreaterThan(lowSig.score);
  });
});

describe('tierAllSignals', () => {
  it('deduplicates by normalized name, keeping intent_required over career_taxonomy', () => {
    const signals: SkillSignal[] = [
      { name: 'DevOps', source: 'career_taxonomy', typeName: 'Common Skill' },
      { name: 'devops', source: 'intent_required' },
    ];
    const result = tierAllSignals(signals);
    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('broad_anchor');
    expect(result[0].source).toBe('intent_required');
  });

  it('deduplicates by normalized name, keeping intent_preferred over career_taxonomy', () => {
    const signals: SkillSignal[] = [
      { name: 'Python', source: 'career_taxonomy', typeName: 'Software Product' },
      { name: 'Python', source: 'intent_preferred' },
    ];
    const result = tierAllSignals(signals);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('intent_preferred');
  });

  it('returns tiered signals for all non-duplicate entries', () => {
    const signals: SkillSignal[] = [
      { name: 'Cloud Computing', source: 'intent_required' },
      { name: 'Python', source: 'intent_preferred' },
      { name: 'Data Analysis', source: 'career_taxonomy', typeName: 'Common Skill' },
    ];
    const result = tierAllSignals(signals);
    expect(result).toHaveLength(3);

    const cc = result.find((s) => s.name === 'Cloud Computing');
    expect(cc?.tier).toBe('broad_anchor');

    const py = result.find((s) => s.name === 'Python');
    expect(py?.tier).toBe('narrow_signal');

    const da = result.find((s) => s.name === 'Data Analysis');
    expect(da?.tier).toBe('role_differentiator');
  });
});
