import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center p-10 text-center">
      <p className="text-5xl font-semibold text-accent">404</p>
      <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The link may be old or mistyped.</p>
      <div className="mt-6 flex gap-3 text-sm"><Link href="/" className="rounded-xl border border-line px-4 py-2 hover:border-accent">Lab website</Link><Link href="/dashboard" className="rounded-xl bg-accent px-4 py-2 text-white">Dashboard</Link></div>
    </main>
  );
}
