/** Kinds the browser reporter can insert into `client_errors`. Keep in sync
 *  with the `kind` check constraint (lib/client-errors-contract.test.ts). */
export const CLIENT_ERROR_KINDS = ["error", "unhandledrejection", "boundary", "csp"] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];
