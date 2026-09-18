import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";

// `contents`: el envoltorio solo lleva las variables de color del morado de
// Taller a todo /app, sin añadir una caja al layout.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div className="palette-taller contents">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
