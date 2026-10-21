import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { PublicServiceMenuView } from '@/components/place/public-service-menu';
const fallback = <p>Verified services and prices are not available yet.</p>;
describe('customer service menu states', () => {
  it('shows price and duration, with escaped merchant text and no booking/payment claim', () => {
    const $ = load(renderToStaticMarkup(<PublicServiceMenuView state={{ kind: 'ready', catalog: { status: 'published', services: [{ id: 'id', category: 'Hair', name: '<script>bad</script>', description: 'Wash and styling', priceKrw: 60000, durationMinutes: 60 }] } }} fallback={fallback} onRetry={() => {}} />));
    expect($('script')).toHaveLength(0); expect($.text()).toContain('<script>bad</script>'); expect($.text()).toContain('60,000'); expect($.text()).toContain('60 min');
    expect($.text()).not.toMatch(/deposit|available today|book now/i);
    expect($.text()).not.toContain('Verified services and prices are not available yet.');
  });
  it('retains the fallback for unpublished menus and published menus with no complete services', () => {
    for (const status of ['published','unpublished'] as const) {
      const html = renderToStaticMarkup(<PublicServiceMenuView state={{ kind: 'ready', catalog: { status, services: [] } }} fallback={fallback} onRetry={() => {}} />);
      expect(html).toContain('Verified services and prices are not available yet.'); expect(html).not.toContain('Retry');
    }
  });
  it('shows retry after an error without an external booking action', () => {
    const $ = load(renderToStaticMarkup(<PublicServiceMenuView state={{ kind: 'error' }} fallback={fallback} onRetry={() => {}} />));
    expect($.text()).not.toContain('Verified services and prices are not available yet.'); expect($('button').text()).toBe('Retry'); expect($('[role="status"]').text()).toContain('temporarily unavailable');
    expect($('a')).toHaveLength(0);
  });
  it('does not report a venue as having no menu while the catalog is loading', () => {
    const $ = load(renderToStaticMarkup(<PublicServiceMenuView state={{ kind: 'loading' }} fallback={fallback} onRetry={() => {}} />));
    expect($.text()).not.toContain('Verified services and prices are not available yet.');
    expect($('[role="status"]').text()).toBe('Checking venue menus…');
    expect($('button, a')).toHaveLength(0);
  });
});
