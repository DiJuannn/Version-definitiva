// Revierte la paleta nueva de la productora (definida en (public)/layout.tsx)
// solo para /taller — el naranja original vive en :root de globals.css, así
// que basta con anular aquí las variables que .palette-productora cambia.
export default function TallerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ "--accent": "#ff4d1c", "--bg-raised": "#131313" } as React.CSSProperties}>
      {children}
    </div>
  );
}
