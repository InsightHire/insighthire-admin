import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaffSignIn } from './staff-sign-in';

function render(props: { signInHref: string; errorMessage: string | null }) {
  return renderToStaticMarkup(createElement(StaffSignIn, props));
}

describe('StaffSignIn', () => {
  it('renders a single Microsoft sign-in link pointing at the Authio sign-in path', () => {
    const html = render({ signInHref: '/api/auth/sign-in?next=%2Forgs', errorMessage: null });
    expect(html).toContain('Sign in with Microsoft');
    expect(html).toContain('href="/api/auth/sign-in?next=%2Forgs"');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toMatch(/type="password"|<form/);
    expect(html).toContain('data-testid="microsoft-logo"');
    expect(html).not.toContain('role="alert"');
  });

  it('puts the logo directly above the heading', () => {
    const html = render({ signInHref: '/x', errorMessage: null });
    const logo = html.indexOf('alt="InsightHire"');
    const heading = html.indexOf('<h1');
    expect(logo).toBeGreaterThan(-1);
    expect(heading).toBeGreaterThan(logo);
    expect(html.slice(logo, heading)).not.toMatch(/<p[ >]/);
    expect(html).toContain('Staff sign in');
  });

  it('keeps the screen clean: no eyebrow, subtext, access note or sample cards', () => {
    const html = render({ signInHref: '/x', errorMessage: null });
    for (const text of [
      'InsightHire Admin',
      'Microsoft account',
      'Restricted to',
      'Run InsightHire',
      'Lakeshore',
      'Deploy healthy',
      'Legal review',
      'Early pay',
      'Onboarding',
    ]) {
      expect(html).not.toContain(text);
    }
  });

  it('renders a text-free, hidden geometric brand panel', () => {
    const html = render({ signInHref: '/x', errorMessage: null });
    const start = html.indexOf('data-testid="auth-brand-panel"');
    const panel = html.slice(start, html.indexOf('<style', start));
    expect(html.slice(html.lastIndexOf('<div', start), start)).toContain('aria-hidden');
    expect(panel).toContain('data-testid="auth-geometry"');
    expect(panel).not.toMatch(/<(p|h\d|span|text|img)[ >]/);
  });

  it('uses no photos, only the logo image', () => {
    const imgs = render({ signInHref: '/x', errorMessage: null }).match(/<img [^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain('alt="InsightHire"');
  });

  it('shows the error message when present', () => {
    const html = render({ signInHref: '/x', errorMessage: 'Sign-in failed. Please try again.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Sign-in failed. Please try again.');
  });
});
