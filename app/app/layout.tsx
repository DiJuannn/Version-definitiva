import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";

// `contents`: el envoltorio solo lleva las variables (morado de Taller, letra de
// herramienta) a todo /app, sin añadir una caja al layout.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="palette-taller taller-ui contents">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
