"use client";

// The front door's working parts. Game 1, the drink race: the race-code box
// for staff, running a race, and the demo (one tap away even on a live
// deployment, so venues can try it). Game 2, the specs test, and your
// personal bests. Then the races this phone already knows.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadMyRaces, type MyRace } from "@/lib/myRaces";
import { isLiveConfigured } from "@/lib/supabase/client";

function DoorLink({ href, label, aside }: { href: string; label: string; aside: string }) {
  return (
    <Link href={href} className="group -mt-1 flex items-baseline py-3">
      <span className="display text-3xl text-cream-100 transition-colors group-hover:text-brass-400 group-active:text-brass-400">
        {label}
      </span>
      <span className="leader" />
      <span className="chalk text-xl text-cream-400">{aside}</span>
    </Link>
  );
}

export default function FrontDoor() {
  const router = useRouter();
  const live = isLiveConfigured();
  const [code, setCode] = useState("");
  const [mine, setMine] = useState<MyRace[]>([]);

  useEffect(() => setMine(loadMyRaces()), []);

  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return (
    <>
      <nav className="space-y-1">
        <p className="ticket border-b-2 border-bar-600 pb-2 text-[10px] text-cream-400">
          Game 1 · The drink race
        </p>

        {live ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (clean) router.push(`/join/${clean}`);
            }}
            className="space-y-1 py-3"
          >
            <label htmlFor="race-code" className="display block text-3xl text-cream-100">
              I&apos;m on the bar
            </label>
            <div className="flex gap-2">
              <input
                id="race-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="race code"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                className="field numerals flex-1 text-xl uppercase tracking-[0.3em]"
              />
              <button
                type="submit"
                disabled={!clean}
                aria-label="Join the race"
                className="pos-key flex items-center border-2 border-brass-400 bg-brass-500 px-4 text-bar-950 disabled:opacity-40"
              >
                <ArrowRight className="size-5" />
              </button>
            </div>
          </form>
        ) : (
          <DoorLink href="/game/demo" label="I'm on the bar" aside="race" />
        )}

        <DoorLink href="/manager" label="I run the bar" aside="start one" />
        {live && <DoorLink href="/manager/demo" label="See the demo" aside="no setup" />}
      </nav>

      <nav className="space-y-1">
        <p className="ticket border-b-2 border-bar-600 pb-2 text-[10px] text-cream-400">
          Game 2 · The specs test
        </p>
        <DoorLink href="/specs" label="Beat the bartender" aside="know your specs" />
        <DoorLink href="/bests" label="My personal bests" aside="the book" />
      </nav>

      {mine.length > 0 && (
        <section className="space-y-1">
          <p className="ticket border-b-2 border-bar-600 pb-2 text-[10px] text-cream-400">
            Your races on this phone
          </p>
          <ul>
            {mine.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.role === "manager" ? `/manager/${r.id}` : `/game/${r.id}`}
                  className="flex items-baseline gap-2 border-b border-dashed border-bar-600 py-2"
                >
                  <span className="display truncate text-xl text-cream-100">{r.drinkName}</span>
                  <span className="chalk truncate text-lg text-cream-400">{r.name}</span>
                  <span className="ticket ml-auto shrink-0 text-[10px] text-brass-400">
                    {r.role === "manager" ? "manage" : "race"}
                    {r.code ? ` · ${r.code}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
