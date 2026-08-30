"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "vd-cookie-notice-dismissed";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // localStorage solo existe en el cliente: el estado inicial debe ser
    // `false` (igual que en el servidor) para no desajustar la hidratación,
    // así que esta primera activación tiene que hacerse en un efecto.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage no disponible — el aviso volverá a aparecer, sin problema.
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl font-mono text-xs text-muted">
          Solo usamos cookies técnicas necesarias para el inicio de sesión.
          Sin cookies de analítica ni publicidad.{" "}
          <Link href="/legal/cookies" className="text-fg underline hover:text-accent">
            Más info
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
