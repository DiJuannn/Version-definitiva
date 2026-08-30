// Sin esto, Next.js no muestra nada mientras la página de destino carga
// sus datos en el servidor — la navegación se queda quieta y luego salta
// de golpe. Este archivo hace que se vea de inmediato, sin esperar a que
// termine de cargar el contenido real.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-muted uppercase">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Cargando…
      </div>
    </div>
  );
}
