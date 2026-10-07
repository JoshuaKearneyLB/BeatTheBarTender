"use client";

// My personal bests: the specs test, per opponent, worked out from every
// game this phone has played — plus the specs worth another look.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, WifiOff } from "lucide-react";
import PixelToken from "@/components/PixelToken";
import { loadProfile, saveProfile, type Profile } from "@/lib/profile";
import { DIFFICULTIES, bestsFor, specsToStudy, wonRun, type SpecsRun } from "@/lib/specs";
import { loadRuns } from "@/lib/specsStore";
import { isLiveConfigured } from "@/lib/supabase/client";
import { DEFAULT_TOKEN, PLAYER_TOKENS } from "@/lib/tokens";

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
}

function linesLabel(n: number | null): string {
  if (n === null) return "—";
  return n === 0 ? "before line 1" : `on line ${n}`;
}

function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState(DEFAULT_TOKEN);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    setEditing(!p);
    if (p) {
      setName(p.name);
      setToken(p.token);
    }
  }, []);

  if (!editing && profile) {
    return (
      <div className="flex items-center gap-3">
        <span className="chip size-11">
          <PixelToken id={profile.token} size={28} title={profile.name} />
        </span>
        <span className="display min-w-0 flex-1 truncate text-3xl" data-testid="profile-name">
          {profile.name}
        </span>
        <button onClick={() => setEditing(true)} className="chalk text-lg text-cream-400 underline-offset-4 hover:underline">
          change
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const p = { name: name.trim(), token };
        saveProfile(p);
        setProfile(p);
        setEditing(false);
      }}
      className="panel space-y-3 p-3"
    >
      <p className="chalk text-xl text-cream-400">who&apos;s this phone?</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        aria-label="Your name"
        maxLength={24}
        className="field w-full"
      />
      <div className="grid grid-cols-8 gap-1.5">
        {PLAYER_TOKENS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setToken(t.id)}
            aria-pressed={token === t.id}
            aria-label={t.name}
            className={`pos-key flex justify-center border-2 py-1.5 ${
              token === t.id ? "border-brass-400 bg-brass-500/25" : "border-bar-600 bg-bar-900"
            }`}
          >
            <PixelToken id={t.id} size={20} />
          </button>
        ))}
      </div>
      <button type="submit" className="pos-key display w-full border-2 border-brass-400 bg-brass-500 py-2 text-xl text-bar-950">
        Save
      </button>
    </form>
  );
}

export default function BestsPage() {
  const [runs, setRuns] = useState<SpecsRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns()
      .then(setRuns)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-4">
      <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
        <ArrowLeft className="size-4" /> Front door
      </Link>
      <h1 className="display -rotate-1 text-5xl leading-none text-brass-400 [text-shadow:3px_3px_0_rgba(0,0,0,0.6)]">
        My personal bests
      </h1>

      <ProfileCard />

      {error ? (
        <p className="flex items-center gap-2 text-danger-400">
          <WifiOff className="size-5 shrink-0" /> {error}
        </p>
      ) : runs === null ? (
        <p className="chalk flex items-center gap-2 text-2xl text-cream-400">
          <Loader2 className="size-5 animate-spin" /> opening the book…
        </p>
      ) : runs.length === 0 ? (
        <div className="space-y-3">
          <p className="chalk text-2xl text-cream-400">nothing in the book yet.</p>
          <Link
            href="/specs"
            className="pos-key display block border-2 border-brass-400 bg-brass-500 py-3 text-center text-2xl text-bar-950"
          >
            Play the specs test
          </Link>
        </div>
      ) : (
        <>
          {/* per opponent */}
          <section className="space-y-3" data-testid="bests-cards">
            {DIFFICULTIES.map((d) => {
              const b = bestsFor(runs, d.key);
              return (
                <div key={d.key} className="panel" data-testid={`best-${d.key}`}>
                  <div className="panel-head">
                    <span>
                      vs {d.name} · {d.label}
                    </span>
                    <span>
                      {b.won}/{b.played} won
                    </span>
                  </div>
                  {b.played === 0 ? (
                    <p className="chalk px-3 py-3 text-lg text-cream-400">not played yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 px-3 py-3 text-center">
                      <div>
                        <p className="numerals text-3xl text-brass-400" data-testid={`best-score-${d.key}`}>
                          {b.bestScore}
                        </p>
                        <p className="ticket text-[9px] text-cream-400">best · {when(b.bestScoreAt)}</p>
                      </div>
                      <div>
                        <p className="numerals text-3xl text-cream-100">{b.bestStreak}</p>
                        <p className="ticket text-[9px] text-cream-400">on the trot</p>
                      </div>
                      <div>
                        <p className="numerals pt-2 text-sm text-cream-100">{linesLabel(b.fastestLines)}</p>
                        <p className="ticket text-[9px] text-cream-400">fastest call</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* what to study */}
          <section className="space-y-2">
            <h2 className="display text-2xl text-brass-400">Specs to study</h2>
            {(() => {
              const study = specsToStudy(runs);
              if (!study.length) {
                return <p className="chalk text-xl text-cream-400">you&apos;ve nailed every spec you&apos;ve seen.</p>;
              }
              return (
                <ul className="space-y-2" data-testid="study-list">
                  {study.map((s) => (
                    <li key={s.drink.id}>
                      <details className="receipt px-3 py-2">
                        <summary className="flex cursor-pointer items-baseline gap-2">
                          <span className="display flex-1 text-xl">{s.drink.name}</span>
                          <span className="ticket text-[10px] text-ink-900/70">
                            {s.missed ? `missed ${s.missed}/${s.seen}` : "slow to call"}
                          </span>
                        </summary>
                        <ul className="mt-2 border-t border-dashed border-ink-900/40 pt-2 font-mono text-xs leading-relaxed">
                          {s.drink.ingredients.map((i) => (
                            <li key={i}>{i}</li>
                          ))}
                          <li className="ticket mt-1 text-[10px] text-ink-900/70">Garnish: {s.drink.garnish}</li>
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>

          {/* recent games */}
          <section className="space-y-2">
            <h2 className="display text-2xl text-brass-400">Last 10 games</h2>
            <ul data-testid="recent-runs">
              {runs.slice(0, 10).map((r, i) => {
                const d = DIFFICULTIES.find((x) => x.key === r.difficulty);
                return (
                  <li
                    key={r.id ?? `${r.playedAt}-${i}`}
                    className="flex items-baseline gap-2 border-b border-dashed border-bar-600 py-2 text-sm"
                  >
                    <span className="ticket w-14 shrink-0 text-[10px] text-cream-400">{when(r.playedAt)}</span>
                    <span className="min-w-0 flex-1 truncate">vs {d?.name ?? r.difficulty}</span>
                    <span className="numerals">
                      {r.playerScore}
                      <span className="text-cream-400"> – {r.houseScore}</span>
                    </span>
                    <span
                      className={`stamp text-xs ${
                        wonRun(r) ? "text-mint-400" : r.playerScore === r.houseScore ? "text-cream-400" : "text-danger-400"
                      }`}
                    >
                      {wonRun(r) ? "won" : r.playerScore === r.houseScore ? "tie" : "lost"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <p className="chalk mt-auto pb-4 text-base text-cream-400/80">
        {isLiveConfigured()
          ? "kept against this phone's sign-in. clearing your browser data starts a fresh book."
          : "kept on this phone."}
      </p>
    </main>
  );
}
