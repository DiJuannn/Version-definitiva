import { NotFoundMessage } from "@/components/NotFoundMessage";

// Direcciones que no existen en ninguna parte de la web.
export default function NotFound() {
  return (
    <main id="contenido" className="palette-productora min-h-screen bg-bg text-fg">
      <NotFoundMessage />
    </main>
  );
}
