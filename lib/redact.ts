// Masks credentials that can ride along in browser error text before it is
// persisted (OWASP Logging Cheat Sheet: never log session ids, access tokens
// or credentials). Parameter names are kept so the row is still debuggable.

const TOKEN_PARAMS =
  /([?&#](?:code|token|access_token|refresh_token|id_token|provider_token|apikey|api_key|key|password|secret|session)=)[^&\s#'"]+/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

export function redactSensitive(text: string): string {
  if (!text) return text;
  return text
    .replace(TOKEN_PARAMS, "$1[redacted]")
    .replace(JWT, "[jwt]")
    .replace(EMAIL, "[email]");
}
