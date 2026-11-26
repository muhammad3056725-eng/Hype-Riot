// HYPE RIOT dataset loading: manifest once at boot, packs on demand,
// the pitch pool (Quick Arcade) lazily. All paths are relative to the
// page, so the build works at any mount point (base "./").
import type { ContentPack, DataManifest, PitchPool } from "@hype-riot/shared-types";

const DATA_BASE = "data/v1";
const LAUNCH_EPOCH_DAYS = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

export interface DailyInfo {
  date: string; // YYYY-MM-DD (UTC)
  seed: number; // days since 1970-01-01
  riotNumber: number; // days since launch + 1
  packId: number;
  arenaTheme: number;
}

/** Daily Riot — identical math to pipeline/daily.py. */
export function dailyFor(date: Date, manifest: Pick<DataManifest, "packs" | "dailyStride" | "dailyOffset">): DailyInfo {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const seed = Math.floor(utc / 86400000);
  const riotNumber = seed - LAUNCH_EPOCH_DAYS + 1;
  const n = manifest.packs;
  const raw = (manifest.dailyOffset + (riotNumber - 1) * manifest.dailyStride) % n;
  return {
    date: new Date(utc).toISOString().slice(0, 10),
    seed,
    riotNumber,
    packId: (raw + n) % n,
    arenaTheme: seed % 6,
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_BASE}/${path}`, { cache: "default" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadManifest(): Promise<DataManifest> {
  return getJson<DataManifest>("manifest.json");
}

const packCache = new Map<number, Promise<ContentPack>>();

export function loadPack(packId: number): Promise<ContentPack> {
  let p = packCache.get(packId);
  if (!p) {
    p = getJson<ContentPack>(`packs/pack_${String(packId).padStart(3, "0")}.json`);
    packCache.set(packId, p);
    p.catch(() => packCache.delete(packId));
  }
  return p;
}

let pitchPool: Promise<PitchPool> | null = null;

export function loadPitchPool(): Promise<PitchPool> {
  if (!pitchPool) {
    pitchPool = getJson<PitchPool>("pitch.json");
    pitchPool.catch(() => (pitchPool = null));
  }
  return pitchPool;
}
