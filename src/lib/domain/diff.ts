/** Shallow diff for audit records: returns only the keys whose values changed. */
export function shallowDiff(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const prev = before?.[key];
    const next = after[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      b[key] = prev ?? null;
      a[key] = next;
    }
  }
  return { before: b, after: a };
}

/** Is (lat,lng) within radius metres of the centre (haversine). */
export function withinRadius(lat: number, lng: number, cLat: number, cLng: number, radiusM: number): boolean {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat - cLat);
  const dLng = toRad(lng - cLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(cLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) <= radiusM;
}
