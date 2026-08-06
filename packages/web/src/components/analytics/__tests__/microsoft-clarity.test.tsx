import { render } from '@testing-library/react';
import { MicrosoftClarity } from '../microsoft-clarity';

describe('MicrosoftClarity', () => {
  afterEach(() => {
    document.querySelectorAll('script#ms-clarity').forEach((el) => el.remove());
  });

  it('renders no script tag when projectId is not set', () => {
    render(<MicrosoftClarity />);

    expect(document.querySelector('script#ms-clarity')).toBeNull();
  });

  it('injects the Clarity snippet with id="ms-clarity" and the project ID when set', () => {
    render(<MicrosoftClarity projectId="test123" />);

    const script = document.querySelector('script#ms-clarity');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('test123');
    expect(script?.textContent).toContain('clarity.ms/tag/');

    // FR-TRK-003 (non-blocking load) — mirrors the same check added to
    // google-analytics.test.tsx (Judgment Day round-1 suspect S5, shared by
    // both components). Merged into this test rather than a separate `it()`:
    // `next/script`'s `LoadCache` is a module-level singleton keyed by `id`
    // — a second test rendering `projectId="test123"` again would
    // short-circuit before creating any element (confirmed: this is exactly
    // what happened when this was first written as a separate test).
    expect(script?.getAttribute('data-nscript')).toBe('afterInteractive');
  });
});
