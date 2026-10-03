import { describe, it, expect, vi } from 'vitest';
import { assertImpersonationLink, openImpersonationLink } from './impersonation-link';

const code = 'f'.repeat(64);
const good = `https://www.insighthire.com/api/auth/impersonate?code=${code}`;

describe('impersonation link', () => {
  it('accepts a one-time code link', () => {
    expect(assertImpersonationLink(good)).toBe(good);
  });

  it('refuses legacy token links and missing values', () => {
    expect(() => assertImpersonationLink('https://www.insighthire.com/impersonate?token=eyJhbGci.x.y')).toThrow();
    expect(() => assertImpersonationLink(undefined)).toThrow();
    expect(() => assertImpersonationLink(`${good}&token=abc`)).toThrow();
  });

  it('opens the link in a new tab with noopener', () => {
    const open = vi.fn();
    openImpersonationLink({ loginUrl: good }, open);
    expect(open).toHaveBeenCalledWith(good, '_blank', 'noopener');
  });
});
