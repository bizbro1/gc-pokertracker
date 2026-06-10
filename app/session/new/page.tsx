import Link from "next/link";
import { NewSessionForm } from "@/components/NewSessionForm";

export default function NewSessionPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link
        href="/"
        className="text-xs uppercase tracking-[0.2em] text-cream-dim hover:text-brass transition"
      >
        &larr; Back to the ledger
      </Link>
      <h1 className="mt-6 font-display text-4xl brass-text">Open a New Table</h1>
      <p className="mt-2 text-sm text-cream-dim">
        Set the stakes. Players join from their phones once the table is open.
      </p>
      <div className="mt-8">
        <NewSessionForm />
      </div>
    </main>
  );
}
