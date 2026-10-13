"use client";

import { ReactNode } from "react";

/**
 * The black box. Covers a value; hover (or `open`) slides the cover away and un-blurs it.
 * - mode "self": hovering the box itself reveals it
 * - mode "group": parent with class `veil-hover` controls it (hover the whole row)
 */
export function Veiled({ children, open = false, mode = "self", delay = 0, className = "" }: {
  children: ReactNode;
  open?: boolean;
  mode?: "self" | "group";
  delay?: number;
  className?: string;
}) {
  return (
    <span
      className={`veil-box ${mode === "self" ? "veil-self" : ""} ${open ? "is-open" : ""} ${className}`}
      style={{ ["--sheen-delay" as any]: `${delay}s` }}
    >
      <span className="veil-content">{children}</span>
      <span className="veil-cover" aria-hidden />
    </span>
  );
}
