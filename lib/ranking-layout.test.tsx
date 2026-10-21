import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { BrandsPanel, RankingPageClient } from '@/components/ranking/ranking-page-client';
import { PRODUCTS, brandSlug } from './data';
import { routes } from './routes';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back() {}, replace() {} }), usePathname: () => '/ranking' }));

describe('ranking fixed controls and independently scrollable results', () => {
  it.each(['olive_young', 'daiso'] as const)('keeps %s heading, tabs, category filters and footer outside the only result scroller', retailer => {
    const $ = load(renderToStaticMarkup(<RankingPageClient initialRetailer={retailer} />));
    const scroller = $('[data-testid="ranking-scroll"]');
    expect(scroller.length).toBe(1); expect($('.app-scroll').length).toBe(1);
    expect(scroller.find('header, [role=tablist], [role=group], input, nav, .section-heading').length).toBe(0);
    expect($('h1').closest('.app-scroll').length).toBe(0);
    expect($('[role=tablist]').closest('.app-scroll').length).toBe(0);
    expect($('[role=group]').closest('.app-scroll').length).toBe(0);
    expect($('[data-testid="ranking-footer"]').parent().attr('data-testid')).toBe('ranking-screen');
    const rows = $(`[data-testid="${retailer === 'daiso' ? 'daiso' : 'olive-young'}-ranking-row"]`);
    expect(rows.length).toBeGreaterThan(0);
    rows.each((_, row) => expect($(row).closest('[data-testid="ranking-scroll"]').length).toBe(1));
  });
  it.each(['olive_young', 'daiso'] as const)('retains keyboard-tab semantics and pressed filters for %s', retailer => {
    const $ = load(renderToStaticMarkup(<RankingPageClient initialRetailer={retailer} />));
    const selected = $('[role=tab][aria-selected=true]');
    expect(selected.length).toBe(1); expect(selected.attr('tabindex')).toBe('0');
    expect($(`[id="${selected.attr('aria-controls')}"]`).attr('aria-labelledby')).toBe(selected.attr('id'));
    expect($('[role=tab][aria-selected=false]').toArray().every(node => $(node).attr('tabindex') === '-1')).toBe(true);
    const categories = $('[role=group] button');
    expect(categories.length).toBeGreaterThan(1);
    expect(categories.filter('[aria-pressed=true]').text()).toBe('All');
    expect(categories.toArray().every(node => $(node).hasClass('chip') && $(node).children('span').length === 1)).toBe(true);
  });
  it('keeps brand search and its count outside the list, using the existing mobile search input', () => {
    const $ = load(renderToStaticMarkup(<BrandsPanel products={PRODUCTS} />));
    const input = $('input[type=search]');
    expect(input.length).toBe(1); expect(input.closest('.app-scroll').length).toBe(0);
    expect(input.attr('aria-label')).toBe('Search brands'); expect(input.attr('inputmode')).toBe('search');
    expect(input.attr('style')).toContain('font-size:16px');
    expect($('.section-heading').closest('.app-scroll').length).toBe(0);
    const brands = [...new Set(PRODUCTS.map(product => product.brand))].sort((a, b) => a.localeCompare(b));
    expect($('[data-testid="ranking-scroll"] a').map((_, node) => $(node).attr('href')).get()).toEqual(brands.map(brand => routes.brand(brandSlug(brand))));
  });
  it('keeps an unavailable Daiso dataset empty while retaining the result region and retailer navigation', () => {
    const $ = load(renderToStaticMarkup(<RankingPageClient initialRetailer="daiso" daisoProducts={[]} />));
    expect($('[data-testid="ranking-scroll"]').length).toBe(1);
    expect($('[data-testid="daiso-ranking-row"]').length).toBe(0);
    expect($('[data-testid="olive-young-ranking-row"]').length).toBe(0);
    expect($('[data-testid="ranking-footer"] button').length).toBe(3);
  });
  it('leaves category recovery inside an empty result while keeping the selected period and filters accessible', () => {
    const $ = load(renderToStaticMarkup(<RankingPageClient initialRetailer="daiso" initialDaisoCategory="unavailable-test-category" />));
    expect($('[role=tab][aria-selected=true]').text()).toBe('Daily');
    expect($('[role=group]').closest('.app-scroll').length).toBe(0);
    expect($('[data-testid="ranking-scroll"] button').text()).toContain('Clear filters');
    expect($('[data-testid="daiso-ranking-row"]').length).toBe(0);
  });
});
