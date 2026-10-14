import { describe, expect, it, vi } from 'vitest';
import { leaveTvToHome } from './tv-platform-back';

describe('leaving the TV entry screen', () => {
  it('uses LG Home navigation when PalmSystem is available', () => {
    const platformBack = vi.fn();
    const close = vi.fn();
    leaveTvToHome({ PalmSystem: { platformBack }, close });
    expect(platformBack).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it('preserves the browser fallback if no LG platform API exists', () => {
    const close = vi.fn();
    leaveTvToHome({ close });
    expect(close).toHaveBeenCalledOnce();
  });
});
