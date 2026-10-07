"use client";

// The manager's clipboard: the link to send the crew, the live race, and
// the end-of-night till check — nudge anyone's count to match the till. A
// correction can hand the win to someone else or reopen the race. In live
// mode every correction sends the PIN, checked in the database.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, KeyRound, Loader2, WifiOff } from "lucide-react";
import EventTicker from "@/components/race/EventTicker";
import Leaderboard from "@/components/race/Leaderboard";
import RaceTrack from "@/components/race/RaceTrack";
import { totalSold } from "@/lib/race";
import { demoSetupFromParams, demoSetupQuery } from "@/lib/demoSetup";
import { useRace } from "@/lib/useRace";

const PIN_KEY = "baropoly.manager-pin";

function ShareLink({ path, demo }: { path: string; demo: boolean }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Send this to the crew</span>
        <Link href={path} className="underline">
          {demo ? "try the bar view" : "open it"}
        </Link>
      </div>
      <div className="flex items-center gap-2 p-2">
        <code data-testid="share-link" className="ticket min-w-0 flex-1 truncate text-[11px] normal-case text-cream-100">
          {url}
        </code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
          className="pos-key display flex items-center gap-1 border-2 border-brass-400 bg-brass-500 px-3 py-1 text-lg text-bar-950"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function ManagerConsole({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { gameId } = use(params);
  const demoSetup = demoSetupFromParams(use(searchParams));
  const { mode, error, race, events, adjust } = useRace(gameId, demoSetup);
  const [pin, setPin] = useState("");

  // PIN sticks for the session so it's typed once per shift.
  useEffect(() => {
    try {
      setPin(sessionStorage.getItem(PIN_KEY) ?? "");
    } catch {}
  }, []);
  function updatePin(value: string) {
    setPin(value);
    try {
      sessionStorage.setItem(PIN_KEY, value);
    } catch {}
  }

  if (mode === "connecting") {
    return (
      <main className="chalk flex min-h-dvh items-center justify-center gap-2 text-2xl text-cream-400">
        <Loader2 className="size-5 animate-spin" /> loading the race…
      </main>
    );
  }
  if (mode === "error" || !race) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff className="size-8 text-danger-400" />
        <p className="text-danger-400">{error ?? "Race is down. Check the wifi behind the till."}</p>
        <Link href="/" className="text-sm text-cream-400 underline">
          Back to the front door
        </Link>
      </main>
    );
  }

  const winner = race.racers.find((r) => r.id === race.winnerId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-1.5 text-cream-400">
          <ArrowLeft className="size-4 shrink-0" />
          <span className="display truncate text-xl">{race.name} · manager</span>
        </Link>
        <div className="flex items-center gap-2">
          {mode === "live" && (
            <label className="ticket flex items-center gap-1 border-2 border-bar-600 bg-black px-2 py-1">
              <KeyRound className="size-3.5 text-brass-400" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => updatePin(e.target.value)}
                placeholder="PIN"
                aria-label="Manager PIN"
                className="w-14 bg-transparent text-xs text-cream-100 outline-none placeholder:text-cream-400"
              />
            </label>
          )}
          <span className="stamp text-xs text-brass-400">{mode === "demo" ? "Demo" : "Live"}</span>
        </div>
      </header>

      <div>
        <p className="ticket text-[10px] text-cream-400">First to {race.target} wins {race.prize.title}</p>
        <h1 className="display text-4xl leading-none text-brass-400">{race.drinkName}</h1>
      </div>

      {/* the numbers a manager actually wants */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["sold so far", totalSold(race)],
          ["racing", race.racers.length],
          ["leader", race.racers.reduce((m, r) => Math.max(m, r.count), 0)],
        ].map(([label, value]) => (
          <div key={label} className="panel py-2">
            <p className="numerals text-3xl text-cream-100" data-testid={`stat-${label}`}>
              {value}
            </p>
            <p className="ticket text-[9px] text-cream-400">{label}</p>
          </div>
        ))}
      </div>

      {winner && (
        <p className="receipt px-4 py-3 text-center" data-testid="winner-banner">
          <span className="display text-3xl text-ink-900">{winner.name} hit {race.target} first</span>
          <span className="chalk block text-lg text-ink-900/70">
            check their count against the till before you hand it over
          </span>
        </p>
      )}

      <ShareLink
        path={`/game/${race.id}${mode === "demo" ? demoSetupQuery(demoSetup) : ""}`}
        demo={mode === "demo"}
      />

      <RaceTrack race={race} />

      <section className="px-1">
        <EventTicker events={events} />
      </section>

      <section className="space-y-2 pb-4">
        <h2 className="display text-2xl text-brass-400">Till check</h2>
        <p className="chalk text-lg leading-tight text-cream-400">
          at close, nudge anyone whose count doesn&apos;t match the till. the win follows the numbers.
        </p>
        <Leaderboard
          race={race}
          controls={(r) => (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                aria-label={`Correct ${r.name} down one`}
                onClick={() => adjust(r.id, r.count - 1, pin)}
                disabled={r.count === 0}
                className="pos-key border-2 border-bar-600 bg-bar-900 p-2 text-danger-400 disabled:opacity-40"
              >
                <ChevronDown className="size-4" />
              </button>
              <button
                aria-label={`Correct ${r.name} up one`}
                onClick={() => adjust(r.id, r.count + 1, pin)}
                disabled={r.count >= race.target}
                className="pos-key border-2 border-bar-600 bg-bar-900 p-2 text-mint-400 disabled:opacity-40"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>
          )}
        />
      </section>

      <Link
        href="/manager"
        className="pos-key display mb-6 block border-2 border-bar-600 bg-bar-900 py-3 text-center text-xl text-cream-100"
      >
        Start another race
      </Link>
    </main>
  );
}
