import FrontDoor from "@/components/FrontDoor";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-10">
      <header>
        <p className="chalk -rotate-2 text-2xl text-cream-400">two games for the bar —</p>
        <h1 className="display -rotate-1 text-8xl leading-[0.9] text-brass-400 [text-shadow:4px_4px_0_rgba(0,0,0,0.6)]">
          Baropoly
        </h1>
        <p className="chalk mt-3 rotate-1 text-2xl leading-tight text-cream-100">
          race the crew to sell the drink.
          <br />
          beat the bartender on the specs.
        </p>
      </header>

      <FrontDoor />
    </main>
  );
}
