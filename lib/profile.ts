// Who's holding this phone: the name and piece they picked, shared by the
// race (join card) and the specs test (personal bests). Per-device only.

import { DEFAULT_TOKEN } from "./tokens";

export interface Profile {
  name: string;
  token: string;
}

const KEY = "baropoly.profile";

export function loadProfile(): Profile | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return p && typeof p.name === "string" ? { name: p.name, token: p.token ?? DEFAULT_TOKEN } : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ name: profile.name.trim().slice(0, 24), token: profile.token }));
  } catch {
    // storage blocked: the name just won't be remembered
  }
}
