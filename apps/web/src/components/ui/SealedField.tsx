export function SealedField({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`gl-field ${className}`} />;
}

export function SealDots({ n = 6, className = "" }: { n?: number; className?: string }) {
  return (
    <span className={`seal-dots ${className}`} role="img" aria-label="Amount sealed">
      {Array.from({ length: n }).map((_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function KindBadge({ sealed }: { sealed: boolean }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium ${
        sealed ? "bg-sealed-soft text-sealed" : "bg-surface text-mute"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${sealed ? "bg-sealed" : "bg-mute"}`} />
      {sealed ? "Private" : "Public"}
    </span>
  );
}
