// ---------------------------------------------------------------------------
// Data loader
// Fetches from /data/ (public directory) on the client.
// Both files are always fetched together and cached in module scope so
// subsequent calls within the same session don't re-fetch.
// ---------------------------------------------------------------------------

import type { NTRecord, Aggregates } from "./types";

let _records: NTRecord[] | null = null;
let _aggregates: Aggregates | null = null;

export async function loadRecords(): Promise<NTRecord[]> {
  if (_records) return _records;
  const res = await fetch("/data/nt_data.json");
  if (!res.ok) throw new Error(`Failed to load nt_data.json: ${res.status}`);
  _records = await res.json();
  return _records!;
}

export async function loadAggregates(): Promise<Aggregates> {
  if (_aggregates) return _aggregates;
  const res = await fetch("/data/nt_aggregates.json");
  if (!res.ok) throw new Error(`Failed to load nt_aggregates.json: ${res.status}`);
  _aggregates = await res.json();
  return _aggregates!;
}

// ---------------------------------------------------------------------------
// Utility — derive filter option lists dynamically from loaded records.
// This means new values in the data automatically appear in filters.
// ---------------------------------------------------------------------------

export function uniqueValues<T extends string>(
  records: NTRecord[],
  key: keyof NTRecord,
  order?: T[]
): T[] {
  const found = [...new Set(records.map((r) => r[key] as T))].filter(Boolean);
  if (!order) return found.sort();
  // Return items in the prescribed order, then any unknowns appended
  const known = order.filter((v) => found.includes(v));
  const unknown = found.filter((v) => !order.includes(v));
  return [...known, ...unknown];
}
