import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { generatePkcePair } from './pkce';

describe('authio/pkce', () => {
  it('generates verifier/challenge pair with valid PKCE shape', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThan(20);
    expect(codeChallenge).toBe(
      createHash('sha256').update(codeVerifier).digest('base64url'),
    );
  });

  it('generates unique pairs on each call', () => {
    const first = generatePkcePair();
    const second = generatePkcePair();
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });
});
