import { describe, expect, it } from 'vitest';
import {
  authCoreHeaders,
  safeNext,
  AUTHIO_SDK_HEADER,
} from './config';

describe('authio/config', () => {
  it('safeNext allows root-relative paths and blocks open redirects', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });

  it('authCoreHeaders includes SDK and project headers', () => {
    const headers = authCoreHeaders({ 'X-Test': '1' });
    expect(headers['X-Authio-SDK']).toBe(AUTHIO_SDK_HEADER);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Test']).toBe('1');
  });
});
