// Demo Mode has no database, so the manager's setup form travels to the
// demo race in the URL. That way a venue trying the app sees *their* drink,
// number, and prize — on the manager console and the bartender view alike.

export interface DemoSetup {
  name?: string;
  drinkName?: string;
  target?: number;
  prizeTitle?: string;
  badge?: string;
}

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, 80) : undefined;
}

export function demoSetupFromParams(params: Params): DemoSetup {
  const target = Number(one(params.target));
  return {
    name: one(params.name),
    drinkName: one(params.drink),
    target: Number.isInteger(target) && target >= 3 && target <= 200 ? target : undefined,
    prizeTitle: one(params.prize),
    badge: one(params.badge),
  };
}

export function demoSetupQuery(setup: DemoSetup): string {
  const q = new URLSearchParams();
  if (setup.name) q.set("name", setup.name);
  if (setup.drinkName) q.set("drink", setup.drinkName);
  if (setup.target) q.set("target", String(setup.target));
  if (setup.prizeTitle) q.set("prize", setup.prizeTitle);
  if (setup.badge) q.set("badge", setup.badge);
  const s = q.toString();
  return s ? `?${s}` : "";
}
