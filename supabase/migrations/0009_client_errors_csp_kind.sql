-- The reporter has sent kind = 'csp' (securitypolicyviolation) since the CSP
-- went enforced, but the 0005 check only allowed three kinds — every CSP
-- report was rejected by PostgREST and silently swallowed by the reporter.
-- Widen the constraint; lib/client-errors-contract.test.ts pins the two lists.

alter table public.client_errors drop constraint if exists client_errors_kind_check;
alter table public.client_errors
  add constraint client_errors_kind_check
  check (kind in ('error', 'unhandledrejection', 'boundary', 'csp'));
