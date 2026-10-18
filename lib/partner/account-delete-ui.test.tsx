import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { accountDeleteFailure, AccountDeletionFeedback } from '@/components/settings/account-data-controls';

describe('merchant account deletion refusal', () => {
  it('persists support guidance with a fixed local support link', () => {
    const result = accountDeleteFailure({ code: 'MERCHANT_ACCOUNT_REQUIRES_SUPPORT', error: 'no', supportPath: 'https://evil.example' });
    expect(result.support).toBe(true);
    const $ = load(renderToStaticMarkup(<AccountDeletionFeedback message={result.message} />));
    expect($('[role="alert"]').text()).toContain('Your account has not been deleted');
    expect($('a').attr('href')).toBe('/support');
    expect($.text()).toContain('merchant');
  });
  it('keeps other server and network fallback messages separate from support refusal', () => {
    expect(accountDeleteFailure({ error: 'Please retry' })).toEqual({ support: false, message: 'Please retry' });
    expect(accountDeleteFailure(null)).toEqual({ support: false, message: 'Could not delete the account — try again.' });
    expect(accountDeleteFailure({ code: 'OTHER', supportPath: '/support' }).support).toBe(false);
  });
});
