import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  caption?: ReactNode;
  action?: ReactNode;
}

export function SectionHeader({ title, caption, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="section-band">{title}</span>
      {action ? (
        action
      ) : caption ? (
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-wine-dark)]/60">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
