import Link from "next/link";
import { ClipboardCheck, GraduationCap, Martini } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-wide text-brass-400">🎲 Baropoly</h1>
        <p className="mt-2 italic text-cream-400">
          The shift is the board. Sell drinks, roll forward, beat the bar.
        </p>
      </header>

      <nav className="space-y-3">
        <Link
          href="/game/demo"
          className="flex items-center gap-4 rounded-2xl border border-bar-600 bg-bar-800 p-4 transition-colors hover:border-brass-500"
        >
          <Martini className="size-8 shrink-0 text-brass-400" />
          <span>
            <span className="block font-semibold">I&apos;m tending bar</span>
            <span className="text-sm text-cream-400">Tally sales, watch your token move</span>
          </span>
        </Link>
        <Link
          href="/manager"
          className="flex items-center gap-4 rounded-2xl border border-bar-600 bg-bar-800 p-4 transition-colors hover:border-brass-500"
        >
          <ClipboardCheck className="size-8 shrink-0 text-brass-400" />
          <span>
            <span className="block font-semibold">I&apos;m the shift manager</span>
            <span className="text-sm text-cream-400">Set up the game, audit, approve wins</span>
          </span>
        </Link>
        <a
          href="/training/index.html"
          className="flex items-center gap-4 rounded-2xl border border-bar-600 bg-bar-800 p-4 transition-colors hover:border-brass-500"
        >
          <GraduationCap className="size-8 shrink-0 text-brass-400" />
          <span>
            <span className="block font-semibold">Training: Beat the Bartender</span>
            <span className="text-sm text-cream-400">Cocktail-knowledge mini-game for downtime</span>
          </span>
        </a>
      </nav>

      <p className="text-center text-xs text-cream-400">
        v0.1 · runs in Demo Mode until Supabase env vars are set
      </p>
    </main>
  );
}
