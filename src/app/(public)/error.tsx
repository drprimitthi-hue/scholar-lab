"use client";
export default function PublicError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-muted">Please try again in a moment.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-accent px-4 py-2 text-sm text-white">Try again</button>
    </main>
  );
}
