import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SpecsGame from "@/components/specs/SpecsGame";
import "./specs.css";

export const metadata = { title: "Specs Test — Beat the Bartender" };

export default function SpecsPage() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-[640px] px-4 pt-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-cream-400">
          <ArrowLeft className="size-4" /> Front door
        </Link>
      </div>
      <SpecsGame />
    </main>
  );
}
