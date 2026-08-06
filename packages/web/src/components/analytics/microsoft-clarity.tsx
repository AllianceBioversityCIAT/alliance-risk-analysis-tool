import Script from 'next/script';

interface MicrosoftClarityProps {
  /** Microsoft Clarity Project ID. Component renders nothing when falsy. */
  projectId?: string;
}

/**
 * Loads the Microsoft Clarity session-replay/heatmap snippet.
 *
 * Renders `null` entirely when `projectId` is not set (FR-TRK-001) — no
 * `<script>` tag reaches the DOM and no request is made to clarity.ms.
 *
 * No route-tracking hook is needed here: Clarity instruments the History API
 * and detects SPA navigation on its own (with a known limitation on
 * query-param-only route changes — see tasks.md T-002, accepted risk).
 *
 * Masking mitigation (defense-in-depth for Judgment Day C4/N2): masking mode
 * is a Clarity *project dashboard* setting, not a snippet-init parameter, so
 * it cannot be configured here. It must be set to Strict in the Clarity
 * dashboard as a manual, post-implementation step (see
 * `packages/web/CLAUDE.md`'s Analytics section). The highest-risk rendered
 * content additionally carries a `data-clarity-mask="true"` attribute.
 */
export function MicrosoftClarity({ projectId }: Readonly<MicrosoftClarityProps>) {
  if (!projectId) return null;

  // The explicit `id` prop is required: an inline script with no `id` and no
  // `src` has an `undefined` cache key in next/script's dedupe map, so
  // remounts (Fast Refresh, navigation) would re-inject and re-execute the
  // snippet without it.
  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${projectId}");
        `,
      }}
    />
  );
}
