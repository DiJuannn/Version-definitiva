import type { Tone } from "@/lib/domain/labels";
import { cx } from "./cx";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  info: "bg-[var(--tone-info-bg)] text-[var(--tone-info)] border-transparent",
  progress: "bg-[var(--tone-progress-bg)] text-[var(--tone-progress)] border-transparent",
  attention: "bg-[var(--tone-attention-bg)] text-[var(--tone-attention)] border-transparent",
  success: "bg-[var(--tone-success-bg)] text-[var(--tone-success)] border-transparent",
  danger: "bg-[var(--tone-danger-bg)] text-[var(--tone-danger)] border-transparent",
  muted: "bg-[var(--tone-muted-bg)] text-[var(--tone-muted)] border-transparent",
  marker: "bg-marker-soft text-marker-ink border-transparent",
};

export function Chip({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

/**
 * Etiqueta de versión como tira de cinta de carrocero (la que se pega en
 * las cintas y bobinas del montaje). Amarilla = versión aprobada.
 */
export function Tape({
  children,
  variant = "paper",
  className,
  title,
}: {
  children: React.ReactNode;
  variant?: "paper" | "marker" | "dark" | "outline";
  className?: string;
  title?: string;
}) {
  const styles = {
    paper: "bg-[#efe8d2] text-[#3b3423]",
    marker: "bg-marker text-ink",
    dark: "bg-[#2a2e36] text-c-ink",
    outline: "bg-transparent text-c-ink-2 ring-1 ring-inset ring-c-line",
  }[variant];
  return (
    <span title={title} className={cx("tape inline-flex h-6 items-center px-2.5 font-mono text-[12px] font-semibold tracking-wide uppercase", styles, className)}>
      {children}
    </span>
  );
}
