import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-5 text-center text-[var(--text)]">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">404</p>
      <h1 className="font-display mt-2 text-[24px] font-bold">Page not found</h1>
      <p className="mt-2 text-[13px] text-[var(--text-2)]">
        That route doesn&apos;t exist in the Dev Directory.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-soft)] hover:border-[var(--mint-text)] hover:text-[var(--mint-text)]"
      >
        Back to directory
      </Link>
    </div>
  );
}
