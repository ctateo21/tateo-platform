// Shared FEMA flood-zone resolver — the single source of truth for the
// `/api/flood-zone` lookup used by BOTH the Insurance detail view
// (client/src/pages/insurance.tsx) and the Dashboard Insurance overview
// (client/src/pages/dashboard.tsx). Returns null on any failure or when
// FEMA has no zone, so callers never fabricate data.
export type FloodZoneLookup = { zone: string; source: "fema" };

export async function fetchFloodZone(address: string): Promise<FloodZoneLookup | null> {
  const addr = (address ?? "").trim();
  if (!addr) return null;
  try {
    const res = await fetch(`/api/flood-zone?address=${encodeURIComponent(addr)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.zone) return { zone: String(data.zone), source: "fema" };
    return null;
  } catch {
    return null;
  }
}
