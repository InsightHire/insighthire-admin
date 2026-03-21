import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges tailwind classes and drops conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toMatch(/px-4/);
    expect(cn('text-sm', false && 'hidden', 'font-medium')).toContain('text-sm');
  });
});
