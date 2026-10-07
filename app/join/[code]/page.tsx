"use client";

// /join/K7Q2P — the short link (and what the front-door code box opens).
// Resolves the code to its race and drops the bartender straight in.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, WifiOff } from "lucide-react";
import { raceIdForCode } from "@/lib/supabase/db";

export default function JoinByCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    raceIdForCode(code)
      .then((id) => {
        if (cancelled) return;
        if (id) router.replace(`/game/${id}`);
        else setError(`No race with the code ${code.toUpperCase()}. Check it with your manager.`);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff className="size-8 text-danger-400" />
        <p className="text-danger-400">{error}</p>
        <Link href="/" className="text-sm text-cream-400 underline">
          Back to the front door
        </Link>
      </main>
    );
  }
  return (
    <main className="chalk flex min-h-dvh items-center justify-center gap-2 text-2xl text-cream-400">
      <Loader2 className="size-5 animate-spin" /> finding race {code.toUpperCase()}…
    </main>
  );
}
