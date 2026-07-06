import { describe, expect, it, vi } from 'vitest';
import { exchangeAuthorizationCode, hashBootstrapHtml } from './token-exchange';

describe('authio/token-exchange', () => {
  it('hashBootstrapHtml redirects hash tokens into query string', () => {
    const html = hashBootstrapHtml();
    expect(html).toContain('access_token');
    expect(html).toContain('refresh_token');
    expect(html).toContain('/api/auth/login-error');
  });

  it('exchangeAuthorizationCode returns tokens on success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
      }),
    } as Response);

    const tokens = await exchangeAuthorizationCode('code-1', 'https://admin.example.com/callback', 'verifier');
    expect(tokens).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/token'),
      expect.objectContaining({ method: 'POST' }),
    );
    fetchMock.mockRestore();
  });

  it('exchangeAuthorizationCode returns null on HTTP error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const tokens = await exchangeAuthorizationCode('bad', 'https://admin.example.com/callback', 'verifier');
    expect(tokens).toBeNull();
    fetchMock.mockRestore();
  });
});
