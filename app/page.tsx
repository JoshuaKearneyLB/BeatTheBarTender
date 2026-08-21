import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-10">
      <header>
        <p className="chalk -rotate-2 text-2xl text-cream-400">the shift is the board —</p>
        <h1 className="display -rotate-1 text-8xl leading-[0.9] text-brass-400 [text-shadow:4px_4px_0_rgba(0,0,0,0.6)]">
          Baropoly
        </h1>
        <p className="chalk mt-3 rotate-1 text-2xl leading-tight text-cream-100">
          sell your goals, move your piece,
          <br />
          take Last Call off the one next to you
        </p>
      </header>

      <nav className="space-y-1">
        <p className="ticket border-b-2 border-bar-600 pb-2 text-[10px] text-cream-400">
          On tonight
        </p>
        <Link href="/game/demo" className="group flex items-baseline py-3">
          <span className="display text-3xl text-cream-100 transition-colors group-hover:text-brass-400 group-active:text-brass-400">
            I&apos;m tending bar
          </span>
          <span className="leader" />
          <span className="chalk text-xl text-cream-400">tap in</span>
        </Link>
        <Link href="/manager" className="group -mt-1 flex items-baseline py-3">
          <span className="display text-3xl text-cream-100 transition-colors group-hover:text-brass-400 group-active:text-brass-400">
            I run the shift
          </span>
          <span className="leader" />
          <span className="chalk text-xl text-cream-400">chalk it up</span>
        </Link>
        <a href="/training/index.html" className="group -mt-1 flex items-baseline py-3">
          <span className="display text-3xl text-cream-100 transition-colors group-hover:text-brass-400 group-active:text-brass-400">
            Specs test
          </span>
          <span className="leader" />
          <span className="chalk text-xl text-cream-400">beat the bartender</span>
        </a>
      </nav>

      <p className="chalk rotate-1 text-lg text-cream-400/70">
        demo mode till the office wires up the till*
      </p>
    </main>
  );
}
