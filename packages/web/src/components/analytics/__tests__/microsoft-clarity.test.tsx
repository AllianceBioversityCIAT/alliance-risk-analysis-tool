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
  });
});
