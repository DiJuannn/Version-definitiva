// Bloque base para pantallas de carga que imitan la forma real de la
// página (en vez del punto genérico) — misma línea visual que el resto:
// sin esquinas redondeadas, color de borde de la marca, pulso sutil.
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-line ${className ?? ""}`} />;
}
