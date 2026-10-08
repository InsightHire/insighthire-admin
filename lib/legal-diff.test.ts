import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from './legal-diff';

describe('diffLines', () => {
  it('returns only unchanged lines for identical text', () => {
    const lines = diffLines('a\nb', 'a\nb');
    expect(lines.every((l) => l.kind === 'same')).toBe(true);
    expect(diffStats(lines)).toEqual({ added: 0, removed: 0 });
  });

  it('marks a changed line as removed then added, keeping the context', () => {
    expect(diffLines('# Terms\nOld clause\nEnd', '# Terms\nNew clause\nEnd')).toEqual([
      { kind: 'same', text: '# Terms' },
      { kind: 'removed', text: 'Old clause' },
      { kind: 'added', text: 'New clause' },
      { kind: 'same', text: 'End' },
    ]);
  });

  it('handles appended and deleted sections and CRLF input', () => {
    const lines = diffLines('one\r\ntwo\r\nthree', 'one\nthree\nfour');
    expect(lines).toEqual([
      { kind: 'same', text: 'one' },
      { kind: 'removed', text: 'two' },
      { kind: 'same', text: 'three' },
      { kind: 'added', text: 'four' },
    ]);
    expect(diffStats(lines)).toEqual({ added: 1, removed: 1 });
  });
});
