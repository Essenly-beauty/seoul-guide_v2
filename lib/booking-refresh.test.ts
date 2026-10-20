import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeVisibleBookingRefresh } from '@/components/booking/use-booking-resource';
afterEach(() => vi.useRealTimers());
describe('visible booking refresh', () => {
  it('refreshes after 30 seconds, on focus, and on returning to the visible page', () => {
    vi.useFakeTimers();
    const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const browser = new EventTarget();
    const refresh = vi.fn();
    const stop = subscribeVisibleBookingRefresh(refresh, page, browser);
    vi.advanceTimersByTime(29999); expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(refresh).toHaveBeenCalledTimes(1);
    browser.dispatchEvent(new Event('focus')); expect(refresh).toHaveBeenCalledTimes(2);
    page.visibilityState = 'hidden';
    vi.advanceTimersByTime(30000); browser.dispatchEvent(new Event('focus')); expect(refresh).toHaveBeenCalledTimes(2);
    page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange')); expect(refresh).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(30000); browser.dispatchEvent(new Event('focus')); page.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
