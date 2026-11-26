// HYPE RIOT persistence (Blueprint §6 LocalSaveDB): profile, XP/coins,
// daily streak, unlocked cosmetics, settings. localStorage-backed.

export interface Settings {
  crt: "off" | "subtle" | "arcade";
  reducedMotion: boolean;
  legibleFont: boolean;
  sound: boolean;
}

export interface SaveData {
  xp: number;
  coins: number;
  bestScore: number;
  gamesPlayed: number;
  lastDailyDate: string | null;
  dailyStreak: number;
  unlocked: string[];
  equipped: { hoodie: string; visor: string; sneakers: string; pet: string; dance: string };
  settings: Settings;
}

const KEY = "hype-riot:save-v1";

export const DEFAULT_SAVE: SaveData = {
  xp: 0,
  coins: 0,
  bestScore: 0,
  gamesPlayed: 0,
  lastDailyDate: null,
  dailyStreak: 0,
  unlocked: [],
  equipped: { hoodie: "default", visor: "none", sneakers: "default", pet: "none", dance: "none" },
  settings: { crt: "subtle", reducedMotion: false, legibleFont: false, sound: true },
};

export class LocalSaveDB {
  private data: SaveData;

  constructor() {
    this.data = this.read();
  }

  private read(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw) as SaveData;
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        equipped: { ...DEFAULT_SAVE.equipped, ...parsed.equipped },
        settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
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

  /** Records a completed Daily Riot; returns the new streak. */
  recordDaily(dateISO: string): number {
    const prev = this.data.lastDailyDate;
    let streak = 1;
    if (prev) {
      const diffDays = Math.round(
        (Date.parse(dateISO) - Date.parse(prev)) / 86400000,
      );
      if (diffDays === 0) streak = this.data.dailyStreak;
      else if (diffDays === 1) streak = this.data.dailyStreak + 1;
    }
    this.update({ lastDailyDate: dateISO, dailyStreak: streak });
    return streak;
  }
}
