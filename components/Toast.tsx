"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { DURATION, EASE, EASE_EXIT } from "@/lib/motion";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<{
  toast: (kind: ToastKind, message: string) => void;
} | null>(null);

// Sin proveedor (p. ej. una página fuera de /app) no hace nada — nunca debe
// romper la pantalla por querer avisar de algo.
export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? { toast: () => {} };
}

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-success/60 text-success",
  error: "border-danger/70 text-danger",
  info: "border-line text-fg",
};
const KIND_MARK: Record<ToastKind, string> = { success: "✓", error: "!", info: "i" };

// Avisos breves abajo a la izquierda (el FAB de la claqueta vive abajo a la
// derecha). Región aria-live para que un lector de pantalla los anuncie. (El
// movimiento reducido de Motion lo activa MotionProvider para toda la web.)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
      <ToastContext.Provider value={value}>
        {children}
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-5 z-[60] flex max-w-[calc(100vw-6rem)] flex-col gap-2 print:hidden sm:bottom-6 sm:left-6"
        >
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ToastView key={item.id} item={item} onDone={() => dismiss(item.id)} />
            ))}
          </AnimatePresence>
        </div>
      </ToastContext.Provider>
  );
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, item.kind === "error" ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [item.kind, onDone]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0, transition: { duration: DURATION.standard, ease: EASE } }}
      exit={{ opacity: 0, x: -16, transition: { duration: DURATION.quick, ease: EASE_EXIT } }}
      role={item.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 border rounded-lg bg-bg-raised px-4 py-3 text-xs shadow-2xl shadow-black/60 ${KIND_STYLES[item.kind]}`}
    >
      <span aria-hidden className="mt-px font-bold">
        {KIND_MARK[item.kind]}
      </span>
      <span className="text-fg">{item.message}</span>
      <button
        type="button"
        onClick={onDone}
        aria-label="Cerrar aviso"
        className="ml-2 text-muted hover:text-fg"
      >
        ×
      </button>
    </motion.div>
  );
}
