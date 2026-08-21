import Link from "next/link";
import { ClipboardCheck, GraduationCap, Martini } from "lucide-react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-10">
      <header className="text-center">
        <p className="ticket text-xs text-brass-400">The shift is the board</p>
        <h1 className="mt-1 text-5xl font-black uppercase tracking-tight text-cream-100">
          Baropoly
        </h1>
        <p className="mt-3 text-cream-400">
          Sell your goals, move your piece, take Last Call off the person next to you.
        </p>
      </header>

      <nav className="space-y-3">
        <Link
          href="/game/demo"
          className="slab flex items-center gap-4 rounded-lg border-2 border-bar-600 bg-bar-800 p-4 transition-colors hover:border-brass-400"
        >
          <Martini className="size-8 shrink-0 text-brass-400" />
          <span>
            <span className="block font-black uppercase tracking-wide">I&apos;m tending bar</span>
            <span className="text-sm text-cream-400">
              Ring in your count, watch your piece move
            </span>
          </span>
        </Link>
        <Link
          href="/manager"
          className="slab flex items-center gap-4 rounded-lg border-2 border-bar-600 bg-bar-800 p-4 transition-colors hover:border-brass-400"
        >
          <ClipboardCheck className="size-8 shrink-0 text-brass-400" />
          <span>
            <span className="block font-black uppercase tracking-wide">I run the shift</span>
            <span className="text-sm text-cream-400">
              Chalk up the board, sign off wins, keep &apos;em honest
            </span>
          </span>
        </Link>
        <a
          href="/training/index.html"
          className="slab flex items-center gap-4 rounded-lg border-2 border-bar-600 bg-bar-800 p-4 transition-colors hover:border-brass-400"
        >
          <GraduationCap className="size-8 shrink-0 text-brass-400" />
          <span>
            <span className="block font-black uppercase tracking-wide">Specs test</span>
            <span className="text-sm text-cream-400">
              Beat the Bartender — our menu, exact builds, for the dead hours
            </span>
          </span>
        </a>
      </nav>

      <p className="ticket text-center text-[10px] text-cream-400">
        Demo mode until the back office wires up Supabase
      </p>
    </main>
  );
}
