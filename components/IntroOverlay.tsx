"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AjoloteLogo } from "@/components/AjoloteLogo";

const DISPLAY_MS = 1900;
const SESSION_KEY = "vd-intro-seen";

export function IntroOverlay() {
  const [show, setShow] = useState(false);
  const startedRef = useRef(false);

  // Decide una única vez (por sesión de pestaña) si el intro debe mostrarse.
  // Guardado en un ref para que sea inmune al doble-montaje de Strict Mode
  // en desarrollo (que ejecuta efecto→cleanup→efecto en el montaje inicial).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    // sessionStorage solo existe en el cliente: el estado inicial debe ser
    // `false` (igual que en el servidor) para no desajustar la hidratación,
    // así que esta primera activación tiene que hacerse en un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
  }, []);

  // Efecto separado: se dispara cuando `show` pasa a true (una transición de
  // estado posterior al montaje inicial, no la duplica Strict Mode), así el
  // temporizador que oculta el intro no se cancela antes de tiempo.
  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      setShow(false);
    }, DISPLAY_MS);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.div
            className="flex flex-col items-center gap-5"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <AjoloteLogo className="h-16 w-auto text-fg" priority />
            <motion.span
              className="font-mono text-xs tracking-[0.3em] text-muted uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              Versión definitiva
            </motion.span>
            <motion.div className="h-px w-32 overflow-hidden bg-line">
              <motion.div
                className="h-full bg-accent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ originX: 0 }}
                transition={{
                  duration: DISPLAY_MS / 1000 - 0.3,
                  ease: "linear",
                  delay: 0.2,
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
