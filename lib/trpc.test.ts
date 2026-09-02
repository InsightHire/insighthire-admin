import { describe, expect, it } from 'vitest';
import { ensureJsonPostBody } from './trpc';

describe('ensureJsonPostBody', () => {
  it('fills an empty POST with {} and application/json', () => {
    const next = ensureJsonPostBody({ method: 'POST' });
    expect(next.body).toBe('{}');
    expect(new Headers(next.headers).get('content-type')).toBe('application/json');
  });

  it('leaves an existing JSON body alone', () => {
    const body = JSON.stringify({ include: true });
    expect(ensureJsonPostBody({ method: 'POST', body }).body).toBe(body);
  });

  it('does not add a body to GET', () => {
    expect(ensureJsonPostBody({ method: 'GET' }).body).toBeUndefined();
  });
});
