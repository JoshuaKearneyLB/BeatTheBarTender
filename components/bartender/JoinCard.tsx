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
      className="space-y-4 rounded-2xl border border-bar-600 bg-bar-800 p-5 shadow-lg shadow-black/30"
    >
      <div>
        <h2 className="text-lg font-semibold text-brass-400">Join “{gameName}”</h2>
        <p className="text-sm text-cream-400">Pick your name and game piece.</p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        required
        maxLength={24}
        className="w-full rounded-xl border border-bar-600 bg-bar-900 px-3 py-3 text-cream-100 outline-none focus:border-brass-500"
      />
      <div className="flex flex-wrap gap-2">
        {TOKENS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setToken(t)}
            aria-pressed={token === t}
            className={`rounded-xl border p-2 text-2xl transition-colors ${
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
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brass-500 px-4 py-3 font-semibold text-bar-900 transition-colors hover:bg-brass-400 disabled:opacity-50"
      >
        <LogIn className="size-5" /> {busy ? "Joining…" : "Clock in"}
      </button>
    </form>
  );
}
