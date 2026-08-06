'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fires a GA4 `page_view` event on mount and on every subsequent client-side
 * route change (pathname or query-string change).
 *
 * The effect is keyed on `searchParams.toString()` — the string value, not the
 * `ReadonlyURLSearchParams` object identity — because Next.js can hand back a
 * new object instance without the underlying query string having changed,
 * which would otherwise re-fire the event spuriously.
 *
 * No-ops when `window.gtag` is not defined (GA not configured), per
 * FR-TRK-002 "Navigation while GA not configured".
 */
export function useAnalyticsPageview(): void {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParamsString]);
}
