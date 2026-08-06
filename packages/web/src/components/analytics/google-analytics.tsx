'use client';

import { Suspense } from 'react';
import Script from 'next/script';
import { useAnalyticsPageview } from '@/hooks/use-analytics-pageview';

export interface GoogleAnalyticsProps {
  /** GA4 Measurement ID (e.g. `G-XXXXXXXXXX`), from `NEXT_PUBLIC_GA_MEASUREMENT_ID`. */
  measurementId?: string;
}

/**
 * Conditionally loads Google Analytics 4.
 *
 * Renders `null` entirely when `measurementId` is falsy (FR-TRK-001,
 * DD-TRK-001) — no `<script>` tag reaches the DOM and no network request is
 * attempted when GA is not configured.
 *
 * When configured, renders the `gtag/js` loader plus an inline bootstrap
 * script that initializes `gtag` with `send_page_view: false` — automatic
 * pageview tracking is disabled so `GAPageviewTracker` (below) is the single
 * source of `page_view` events (fixes Judgment Day C3; see FR-TRK-002).
 */
export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){ window.dataLayer.push(arguments); }
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <GAPageviewTracker />
      </Suspense>
    </>
  );
}

/**
 * Calls `useAnalyticsPageview()` to fire a `page_view` event on mount and on
 * every route change. Kept as its own component (rather than inlined into
 * `GoogleAnalytics`) because `useSearchParams()` requires a `Suspense`
 * boundary for static export — see DD-TRK-002. Only this small tracker is
 * wrapped, not `GoogleAnalytics` or the layout.
 */
function GAPageviewTracker() {
  useAnalyticsPageview();
  return null;
}
