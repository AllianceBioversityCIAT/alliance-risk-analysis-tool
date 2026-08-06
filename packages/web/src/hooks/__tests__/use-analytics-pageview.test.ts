import { renderHook } from '@testing-library/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAnalyticsPageview } from '../use-analytics-pageview';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

const mockUsePathname = usePathname as jest.Mock;
const mockUseSearchParams = useSearchParams as jest.Mock;

function setRoute(pathname: string, search = '') {
  mockUsePathname.mockReturnValue(pathname);
  mockUseSearchParams.mockReturnValue(new URLSearchParams(search));
}

describe('useAnalyticsPageview', () => {
  const originalGtag = window.gtag;

  afterEach(() => {
    window.gtag = originalGtag;
    jest.clearAllMocks();
  });

  it('calls window.gtag once on initial mount when gtag is configured', () => {
    window.gtag = jest.fn();
    setRoute('/dashboard');

    renderHook(() => useAnalyticsPageview());

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_location: window.location.href,
      page_title: document.title,
    });
  });

  it('calls window.gtag once per subsequent path change', () => {
    window.gtag = jest.fn();
    setRoute('/dashboard');

    const { rerender } = renderHook(() => useAnalyticsPageview());
    expect(window.gtag).toHaveBeenCalledTimes(1);

    setRoute('/assessments/upload');
    rerender();
    expect(window.gtag).toHaveBeenCalledTimes(2);

    // Re-render with no route change must not fire again.
    rerender();
    expect(window.gtag).toHaveBeenCalledTimes(2);
  });

  it('calls window.gtag once per query-string-only change', () => {
    window.gtag = jest.fn();
    setRoute('/assessments/upload', 'id=A');

    const { rerender } = renderHook(() => useAnalyticsPageview());
    expect(window.gtag).toHaveBeenCalledTimes(1);

    setRoute('/assessments/upload', 'id=B');
    rerender();
    expect(window.gtag).toHaveBeenCalledTimes(2);
  });

  it('does not call gtag or throw when window.gtag is undefined', () => {
    window.gtag = undefined;
    setRoute('/dashboard');

    expect(() => renderHook(() => useAnalyticsPageview())).not.toThrow();
  });

  // The fix this hook exists to lock in (Judgment Day round-1 suspect S4):
  // Next.js can hand back a *new* `URLSearchParams` object instance without
  // the underlying query string changing. The effect must be keyed on
  // `searchParams.toString()`, not the object reference — otherwise this
  // exact case would spuriously re-fire `page_view`. `setRoute` builds a new
  // `URLSearchParams` instance on every call, so calling it again with an
  // unchanged string reproduces the regression this test guards against.
  it('does not re-fire when a new URLSearchParams instance has the same string', () => {
    window.gtag = jest.fn();
    setRoute('/assessments/upload', 'id=A');

    const { rerender } = renderHook(() => useAnalyticsPageview());
    expect(window.gtag).toHaveBeenCalledTimes(1);

    setRoute('/assessments/upload', 'id=A'); // new URLSearchParams, same string
    rerender();
    expect(window.gtag).toHaveBeenCalledTimes(1);
  });
});
