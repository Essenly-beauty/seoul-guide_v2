export function compareCatalogRows(expected, actual) {
  const left = new Map(expected.map((row) => [row.id, row.payload_sha256]));
  const right = new Map(actual.map((row) => [row.id, row.payload_sha256]));
  return [
    ...[...left].filter(([id]) => !right.has(id)).map(([id]) => `missing:${id}`),
    ...[...right].filter(([id]) => !left.has(id)).map(([id]) => `extra:${id}`),
    ...[...left].filter(([id, hash]) => right.has(id) && right.get(id) !== hash)
      .map(([id]) => `changed:${id}`),
  ].sort();
}
