export function SealedField({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`gl-field ${className}`} />;
}

/** Sealed amount: a small black box in place of the number. */
export function SealDots({ n = 6, className = "" }: { n?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Amount sealed"
      className={`inline-block h-[1.05em] rounded-[3px] align-middle bg-black ring-1 ring-inset ring-white/10 ${className}`}
      style={{ width: `${Math.max(3, n) * 0.62}em` }}
    />
  );
}

export function KindBadge({ sealed }: { sealed: boolean }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium uppercase tracking-[0.08em] ${
        sealed ? "bg-sealed-soft text-sealed" : "bg-surface text-mute"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-[2px] ${sealed ? "bg-accent" : "bg-mute"}`} />
      {sealed ? "Private" : "Public"}
    </span>
  );
}
