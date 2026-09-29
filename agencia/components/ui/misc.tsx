import type { ReactNode } from "react";
import { cx } from "./cx";

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] text-ink-3">{eyebrow}</div>}
        <h1 className="font-display text-[26px] leading-tight font-bold text-ink md:text-[30px]">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("rounded-lg border border-line bg-surface", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-6">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="max-w-prose text-[13px] text-ink-3">{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "attention" | "danger" | "success"; title?: string; children: ReactNode }) {
  const t = {
    info: "border-[var(--tone-info)]/25 bg-[var(--tone-info-bg)] text-[var(--tone-info)]",
    attention: "border-[var(--tone-attention)]/25 bg-[var(--tone-attention-bg)] text-[var(--tone-attention)]",
    danger: "border-[var(--tone-danger)]/25 bg-[var(--tone-danger-bg)] text-[var(--tone-danger)]",
    success: "border-[var(--tone-success)]/25 bg-[var(--tone-success-bg)] text-[var(--tone-success)]",
  }[tone];
  return (
    <div className={cx("rounded-md border px-3 py-2.5 text-[13px]", t)} role={tone === "danger" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      <div className="text-ink-2">{children}</div>
    </div>
  );
}

export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,max-content)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map((i) => (
        <div key={i.term} className="contents">
          <dt className="text-ink-3">{i.term}</dt>
          <dd className="min-w-0 text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
