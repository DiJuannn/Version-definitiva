// La página de presentación de Taller usa la paleta morada del producto
// (la misma que la plataforma en /app), no la naranja de la productora.
export default function TallerLayout({ children }: { children: React.ReactNode }) {
  return <div className="palette-taller">{children}</div>;
}
