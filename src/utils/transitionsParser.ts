export interface TransitionTimers {
  congrats_countdown: number;
  wheel_intro: number;
  ball_intro: number;
  ball_spinning: number;
  ball_reveal: number;
  victory_screen: number;
  victory_promo_flip: number;
  autopilot_countdown: number;
  winners_leaderboard: number;
  spinning_winner: number;
  wheel_spinning: number;
  presentation_video: number;
  id4_pause: number;
}

export const DEFAULT_TRANSITIONS: TransitionTimers = {
  congrats_countdown: 30,
  wheel_intro: 30,
  ball_intro: 30,
  ball_spinning: 20,
  ball_reveal: 30,
  victory_screen: 90,
  victory_promo_flip: 20,
  autopilot_countdown: 30,
  winners_leaderboard: 30,
  spinning_winner: 5,
  wheel_spinning: 10,
  presentation_video: 30,
  id4_pause: 2,
};

export function parseTransitionsCfg(text: string): TransitionTimers {
  const result = { ...DEFAULT_TRANSITIONS };
  if (!text) return result;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      let rawKey = trimmed.substring(0, idx).trim();
      if (rawKey.includes(",")) {
        const parts = rawKey.split(",");
        rawKey = parts[parts.length - 1].trim();
      }
      const key = rawKey as keyof TransitionTimers;
      const value = trimmed.substring(idx + 1).trim();
      if (key in DEFAULT_TRANSITIONS) {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0) {
          result[key] = num;
        }
      }
    }
  }
  return result;
}

export async function fetchTransitionsCfg(filename: string = "/transitions.cfg"): Promise<TransitionTimers> {
  try {
    const res = await fetch(filename);
    if (!res.ok) {
      return DEFAULT_TRANSITIONS;
    }
    const txt = await res.text();
    return parseTransitionsCfg(txt);
  } catch (error) {
    console.warn(`Failed to fetch ${filename}, using defaults`, error);
    return DEFAULT_TRANSITIONS;
  }
}
