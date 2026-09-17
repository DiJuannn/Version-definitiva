import Image from "next/image";
import { PlaceholderFrame } from "@/components/PlaceholderFrame";

// Hueco de imagen consciente de si tiene foto real o no. Sin `src`, se
// apoya en PlaceholderFrame (mismo grano/viñeta que el resto de la web) con
// una etiqueta que dice exactamente qué fotografía falta ahí — nunca una
// imagen de stock ni contenido inventado. En cuanto alguien pega una URL
// real en /admin, esta misma pieza empieza a mostrarla sin tocar nada más.
export function MediaFrame({
  src,
  alt,
  label,
  className,
  priority,
  sizes,
}: {
  src?: string | null;
  alt: string;
  label?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!src) {
    return (
      <PlaceholderFrame className={className}>
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            {label ?? "Falta fotografía"}
          </span>
        </div>
      </PlaceholderFrame>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-bg-raised ${className ?? ""}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "100vw"}
        className="object-cover"
      />
    </div>
  );
}
