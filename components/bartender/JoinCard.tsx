"use client";

// First-visit card in live mode: pick a name and a token, join the shift.

import { useState } from "react";
import { LogIn } from "lucide-react";
import PixelToken from "@/components/PixelToken";
import { DEFAULT_TOKEN, PLAYER_TOKENS } from "@/lib/tokens";



export default function JoinCard({
  gameName,
  onJoin,
}: {
  gameName: string;
  onJoin: (name: string, token: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onJoin(name, token);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="slab -rotate-1 space-y-4 bg-paper-100 p-5">
      <div>
        <p className="ticket text-[10px] text-ink-900/50">staff rota</p>
        <h2 className="display mt-0.5 text-3xl leading-none text-ink-900">
          On tonight: {gameName}
        </h2>
        <p className="chalk mt-1 text-xl text-ink-900/60">name on the card, pick your piece</p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What do they shout across the bar?"
        required
        maxLength={24}
        className="chalk w-full border-b-2 border-ink-900/40 bg-transparent px-1 py-2 text-2xl text-ink-900 outline-none placeholder:text-ink-900/40 focus:border-ink-900"
      />
      <div className="grid grid-cols-4 gap-2">
        {PLAYER_TOKENS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setToken(t.id)}
            aria-pressed={token === t.id}
            aria-label={t.name}
            data-testid={`token-${t.id}`}
            className={`pos-key flex flex-col items-center gap-1 border-2 py-2 ${
              token === t.id
                ? "border-ink-900 bg-brass-400/50"
                : "border-ink-900/25 bg-ink-900/5"
            }`}
          >
            <PixelToken id={t.id} size={26} />
            <span className="ticket text-[8px] text-ink-900/70">{t.name}</span>
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="pos-key display flex w-full items-center justify-center gap-2 border-2 border-ink-900 bg-ink-900 px-4 py-3 text-2xl text-paper-100 disabled:opacity-50"
      >
        <LogIn className="size-5" /> {busy ? "Clocking in…" : "Clock in"}
      </button>
    </form>
  );
}
