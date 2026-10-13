/**
 * Veil mark: a document with one line redacted. The purple bar is the veil:
 * everything is on-chain, but the part that matters is covered.
 */
export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="1.75" y="1.75" width="28.5" height="28.5" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      <rect x="7.5" y="8.5" width="10" height="1.75" rx="0.875" fill="currentColor" opacity="0.45" />
      <rect x="7.5" y="13.25" width="17" height="5.5" rx="1.5" fill="var(--accent)" className="logo-bar" />
      <rect x="7.5" y="21.75" width="13" height="1.75" rx="0.875" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-foreground ${className}`}>
      <LogoMark />
      <span className="font-display text-[20px] font-medium leading-none tracking-[-0.04em]">veil</span>
    </span>
  );
}
