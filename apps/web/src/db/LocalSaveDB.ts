// HYPE RIOT persistence: profile, XP/coins, daily streak + one scored
// Daily attempt per date, unlocked cosmetics ("slot:id"), settings.
// localStorage-backed; every access is guarded (private mode, quotas).

export type QualitySetting = "auto" | "high" | "low";

export interface Settings {
  sound: boolean;
  reducedMotion: boolean;
  quality: QualitySetting;
}

export interface Equipped {
  hoodie: string;
  visor: string;
  sneakers: string;
  pet: string;
  dance: string;
}

export interface SaveData {
  xp: number;
  coins: number;
  bestScore: number;
  gamesPlayed: number;
  lastDailyDate: string | null;
  dailyStreak: number;
  /** date -> scored total of that day's first Daily attempt. */
  dailyScores: Record<string, number>;
  /** "slot:id" keys. */
  unlocked: string[];
  equipped: Equipped;
  settings: Settings;
}

const KEY = "hype-riot:save-v1";

const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

export function defaultSave(): SaveData {
  return {
    xp: 0,
    coins: 0,
    bestScore: 0,
    gamesPlayed: 0,
    lastDailyDate: null,
    dailyStreak: 0,
    dailyScores: {},
    unlocked: [],
    equipped: { hoodie: "default", visor: "none", sneakers: "default", pet: "none", dance: "none" },
    settings: { sound: true, reducedMotion: prefersReducedMotion(), quality: "auto" },
  };
}

function dayDiff(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400000);
}

export class LocalSaveDB {
  private data: SaveData;

  constructor() {
    this.data = this.read();
  }

  private read(): SaveData {
    const base = defaultSave();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SaveData> & { unlocked?: string[] };
      const settings = { ...base.settings, ...(parsed.settings ?? {}) } as Settings & Record<string, unknown>;
      return {
        ...base,
        ...parsed,
        dailyScores: { ...(parsed.dailyScores ?? {}) },
        // v1 saves stored bare ids; they were unique per slot, so migrate by lookup later
        unlocked: (parsed.unlocked ?? []).map((u) => (u.includes(":") ? u : `legacy:${u}`)),
        equipped: { ...base.equipped, ...(parsed.equipped ?? {}) },
        settings: { sound: settings.sound, reducedMotion: settings.reducedMotion, quality: settings.quality ?? "auto" },
      };
    } catch {
      return base;
    }
  }

  get(): SaveData {
    return this.data;
  }

  update(patch: Partial<SaveData>): SaveData {
    this.data = { ...this.data, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable — session-only play */
    }
    return this.data;
  }

  isUnlocked(slot: string, id: string): boolean {
    return this.data.unlocked.includes(`${slot}:${id}`) || this.data.unlocked.includes(`legacy:${id}`);
  }

  /** The streak as of `todayISO`: a missed day resets it to 0. */
  currentStreak(todayISO: string): number {
    const last = this.data.lastDailyDate;
    if (!last) return 0;
    const gap = dayDiff(last, todayISO);
    return gap <= 1 ? this.data.dailyStreak : 0;
  }

  /** Clears a stale streak on boot so the HUD never shows a dead streak. */
  refreshStreak(todayISO: string): void {
    const s = this.currentStreak(todayISO);
    if (s !== this.data.dailyStreak) this.update({ dailyStreak: s });
  }

  hasPlayedDaily(dateISO: string): boolean {
    return dateISO in this.data.dailyScores;
  }

  /**
   * Records the first (scored) Daily attempt of a date. Returns the new
   * streak, or null when this date was already played (practice run).
   */
  recordDaily(dateISO: string, score: number): number | null {
    if (this.hasPlayedDaily(dateISO)) return null;
    const prev = this.data.lastDailyDate;
    const streak = prev && dayDiff(prev, dateISO) === 1 ? this.data.dailyStreak + 1 : 1;
    const scores = { ...this.data.dailyScores, [dateISO]: score };
    // keep the last 60 days only
    const keys = Object.keys(scores).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete scores[k];
    this.update({ lastDailyDate: dateISO, dailyStreak: streak, dailyScores: scores });
    return streak;
  }
}
