export function isLocalCatalogDatabaseUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["127.0.0.1", "localhost"].includes(url.hostname)
      && url.port === "54322"
      && url.pathname === "/postgres";
  } catch {
    return false;
  }
}
