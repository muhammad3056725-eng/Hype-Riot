// HYPE RIOT dataset loading (Blueprint §4): manifest + entities.bin
// fetched once, packs on demand. entities.bin is the canonical format;
// entities.json is the text fallback for hosts where the binary did
// not land (the GitHub connector push is text-only — same pattern as
// NEXUS RELAY's telemetry fallback).
import {
  parseEntitiesBin,
  type ContentPack,
  type DataManifest,
  type EntityRecord,
} from "@hype-riot/shared-types";

const DATA_BASE = "data/v1";

export interface DailyInfo {
  date: string;
  seed: number;
  riotNumber: number;
  packId: number;
  arenaTheme: number;
}

const LAUNCH_EPOCH_DAYS = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

/** Daily Riot computation — identical math to pipeline/daily.py. */
export function dailyFor(date: Date, packCount: number): DailyInfo {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const seed = Math.floor(utc / 86400000);
  return {
    date: new Date(utc).toISOString().slice(0, 10),
    seed,
    riotNumber: seed - LAUNCH_EPOCH_DAYS + 1,
    packId: seed % packCount,
    arenaTheme: seed % 6,
  };
}

export async function loadManifest(): Promise<DataManifest> {
  const res = await fetch(`${DATA_BASE}/manifest.json`);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return (await res.json()) as DataManifest;
}

export async function loadEntities(manifest: DataManifest): Promise<EntityRecord[]> {
  try {
    const res = await fetch(`${DATA_BASE}/entities.bin`);
    if (!res.ok) throw new Error(`bin ${res.status}`);
    const buf = await res.arrayBuffer();
    const records = parseEntitiesBin(buf);
    if (records.length !== manifest.entities) throw new Error("bin count mismatch");
    return records;
  } catch {
    const res = await fetch(`${DATA_BASE}/entities.json`);
    if (!res.ok) throw new Error(`entities.json fetch failed: ${res.status}`);
    const raw = (await res.json()) as Array<{
      id: number; name: string; categoryId: number; popularity: number;
      eraDecade: number; tagBitmask: number; clusterId: number;
    }>;
    return raw.map((r) => ({
      id: r.id, categoryId: r.categoryId, popularity: r.popularity,
      eraDecade: r.eraDecade, tagBitmask: r.tagBitmask, name: r.name,
      clusterId: r.clusterId,
    }));
  }
}

const packCache = new Map<number, ContentPack>();

export async function loadPack(packId: number): Promise<ContentPack> {
  const cached = packCache.get(packId);
  if (cached) return cached;
  const name = `pack_${String(packId).padStart(3, "0")}.json`;
  const res = await fetch(`${DATA_BASE}/packs/${name}`);
  if (!res.ok) throw new Error(`pack fetch failed: ${res.status}`);
  const pack = (await res.json()) as ContentPack;
  packCache.set(packId, pack);
  return pack;
}
