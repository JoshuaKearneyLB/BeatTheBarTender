"use client";

// First-visit card in live mode: pick a name and a token, join the shift.

import { useState } from "react";
import { LogIn } from "lucide-react";

const TOKENS = ["🦊", "🐙", "🦉", "🐺", "🐝", "🦁", "🐸", "🦄"];

export default function JoinCard({
  gameName,
  onJoin,
}: {
  gameName: string;
  onJoin: (name: string, token: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [token, setToken] = useState(TOKENS[0]);
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
    <form
      onSubmit={submit}
      className="slab space-y-4 rounded-lg border-2 border-bar-600 bg-bar-800 p-5"
    >
      <div>
        <h2 className="ticket text-sm font-black text-brass-400">On tonight: “{gameName}”</h2>
        <p className="mt-1 text-sm text-cream-400">Name on the rota, pick your piece.</p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What do they shout across the bar?"
        required
        maxLength={24}
        className="w-full rounded-md border-2 border-bar-600 bg-bar-950 px-3 py-3 text-cream-100 outline-none placeholder:text-cream-400 focus:border-brass-500"
      />
      <div className="flex flex-wrap gap-2">
        {TOKENS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setToken(t)}
            aria-pressed={token === t}
            className={`pos-key border-2 p-2 text-2xl transition-colors ${
              token === t ? "border-brass-500 bg-brass-500/15" : "border-bar-600 bg-bar-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="pos-key flex w-full items-center justify-center gap-2 border-2 border-brass-400 bg-brass-500 px-4 py-3 font-black uppercase tracking-wide text-bar-950 disabled:opacity-50"
      >
        <LogIn className="size-5" /> {busy ? "Clocking in…" : "Clock in"}
      </button>
    </form>
  );
}
