import Link from "next/link";

// El próximo rodaje como una claqueta: la jornada, la citación, cuánto
// falta, escenas y planos, y lo que toca hacer. Se usa en Inicio y en la
// portada del proyecto.
export function ShootSlate({
  eyebrow,
  date,
  callTime,
  wrap,
  scenes,
  shots,
  warning,
  action,
}: {
  eyebrow: string;
  date: Date;
  callTime: string | null;
  // Fin previsto (si hay orden de rodaje); si no, la cuenta atrás.
  wrap?: string | null;
  scenes: string;
  shots: number;
  warning?: string | null;
  action?: { href: string; label: string };
}) {
  const day = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = new Date(day);
  startOfDay.setHours(0, 0, 0, 0);
  const inDays = Math.round((startOfDay.getTime() - today.getTime()) / 86_400_000);
  const countdown = inDays <= 0 ? "Hoy" : inDays === 1 ? "Mañana" : `${inDays} días`;
  const when = day.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", timeZone: "Europe/Madrid" });

  // Un dato que falta no se pinta como «—» (parece un error): se dice que
  // está por fijar, apagado.
  const cell = (label: string, value: string | null) => (
    <div className="border-b border-line py-3 odd:border-r odd:pr-3 even:pl-4">
      <p className="eyebrow">{label}</p>
      {value ? (
        <p className="poster-sub mt-1.5 text-[28px] leading-none normal-case">{value}</p>
      ) : (
        <p className="mt-2 font-sans text-[15px] leading-none text-muted">Por fijar</p>
      )}
    </div>
  );

  return (
    <aside
      aria-label="Próximo rodaje"
      className="overflow-hidden rounded-md bg-[#0d0d10] shadow-[0_0_0_1px_var(--line),0_24px_48px_-24px_#000]"
    >
      <div aria-hidden className="h-6 bg-[repeating-linear-gradient(-55deg,#ece9e2_0_16px,#0d0d10_16px_32px)]" />
      <div className="px-5 pt-4 pb-5">
        <p className="eyebrow">{eyebrow}</p>
        <p className="poster-title mt-1 text-[42px] first-letter:uppercase">{when}</p>
        <div className="mt-3 grid grid-cols-2 border-t border-line">
          {cell("Citación", callTime)}
          {cell(wrap ? "Fin previsto" : "Cuenta atrás", wrap ?? countdown)}
          {cell("Escenas", scenes || null)}
          {cell("Planos", shots ? String(shots) : null)}
        </div>
        {warning && <p className="mt-3 font-sans text-[13px] text-warn">● {warning}</p>}
        {action && (
          <Link href={action.href} className="btn btn-primary mt-4 w-full">
            {action.label}
          </Link>
        )}
      </div>
    </aside>
  );
}
