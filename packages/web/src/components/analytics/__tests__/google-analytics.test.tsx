import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GoogleAnalytics } from '../google-analytics';

// GoogleAnalytics renders GAPageviewTracker (wrapped in Suspense), which calls
// usePathname()/useSearchParams() via useAnalyticsPageview(). Those hooks need
// an App Router context that isn't present under a plain RTL render, so they
// are mocked here — this file only tests script injection, not the hook's
// pageview-firing behavior (covered by use-analytics-pageview.test.ts).
jest.mock('next/navigation', () => ({
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams(''),
}));

// `next/script`'s `afterInteractive` scripts are injected imperatively via
// `document.body.appendChild` in a `useEffect`, and next/script tracks
// per-src/id "already loaded" state in a module-level cache that survives
// for the lifetime of this test file. That means a script loaded by one test
// can make a *later* "not loaded" assertion for the same src/id falsely pass
// (Judgment Day round-1 pitfall). This file avoids the hazard structurally
// instead of via `jest.resetModules()` between tests — resetting modules here
// would re-require `react`/`react-dom` fresh for the dynamically-reloaded
// component while `@testing-library/react` keeps its own already-loaded copy,
// producing a duplicate-React "Invalid hook call" error. Instead:
//   - the "no measurementId" test never renders a <Script>, so it never
//     touches the cache;
//   - "G-TEST00000" is rendered exactly once across this whole file (in the
//     second test only), so there is no prior load for it to collide with.
// Scripts are still removed from the DOM in `afterEach` as a defensive
// measure for anyone adding further tests to this file.
describe('GoogleAnalytics', () => {
  afterEach(() => {
    cleanup();
    // `next/script` appends scripts directly to `document.body`, outside the
    // React tree RTL's `cleanup()` unmounts — remove them explicitly so a
    // leftover tag from one test can't be seen by the next.
    document.querySelectorAll('script').forEach((el) => el.remove());
  });

  it('renders no GA script tag when measurementId is not provided', () => {
    const { container } = render(<GoogleAnalytics measurementId={undefined} />);

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(document.querySelector('script#ga-gtag-init')).toBeNull();
  });

  it('renders the GA loader and bootstrap scripts when measurementId is provided', () => {
    render(<GoogleAnalytics measurementId="G-TEST00000" />);

    const loader = document.querySelector('script[src*="googletagmanager"]');
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute('src')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-TEST00000',
    );

    const bootstrap = document.querySelector('script#ga-gtag-init');
    expect(bootstrap).not.toBeNull();
    expect(bootstrap?.textContent).toContain('send_page_view: false');
    expect(bootstrap?.textContent).toContain("gtag('config', 'G-TEST00000'");
  });
});
