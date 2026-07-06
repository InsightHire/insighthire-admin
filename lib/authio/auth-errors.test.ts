import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('authio/auth-errors', () => {
  it('maps known codes to user-facing copy', () => {
    expect(authErrorMessage('missing_tokens')).toContain('session');
    expect(authErrorMessage('csrf_mismatch')).toContain('security');
  });

  it('returns generic copy for unknown codes', () => {
    expect(authErrorMessage('something_else')).toContain('Sign-in failed');
    expect(authErrorMessage(null)).toBeNull();
  });
});
