// Races this phone has opened or joined, so nobody has to dig the link out
// of the group chat again. Per-device convenience only — the races
// themselves live in the database.

export interface MyRace {
  id: string;
  code?: string;
  name: string;
  drinkName: string;
  role: "manager" | "racer";
  /** ISO time last opened. */
  seenAt: string;
}

const KEY = "baropoly.my-races";
const LIMIT = 8;

export function loadMyRaces(): MyRace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as MyRace[]) : [];
  } catch {
    return [];
  }
}

/** Remember a race; a manager entry is never downgraded to racer. */
export function rememberRace(race: Omit<MyRace, "seenAt">): void {
  try {
    const all = loadMyRaces();
    const prev = all.find((r) => r.id === race.id);
    const entry: MyRace = {
      ...race,
      role: prev?.role === "manager" ? "manager" : race.role,
      seenAt: new Date().toISOString(),
    };
    const next = [entry, ...all.filter((r) => r.id !== race.id)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode or storage blocked: the link still works
  }
}
