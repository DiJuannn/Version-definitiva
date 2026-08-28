import type { ReactNode } from "react";

export function PlaceholderFrame({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden bg-bg-raised ${className ?? ""}`}
      style={{
        backgroundImage:
          "radial-gradient(120% 140% at 15% -10%, #232320 0%, #101010 55%, #0a0a0a 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.4] transition-opacity duration-500 group-hover:opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        aria-hidden
        className="absolute -inset-1 scale-105 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(120deg, transparent 30%, rgba(255,77,28,0.08) 50%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
