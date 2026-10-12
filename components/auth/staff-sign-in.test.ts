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
