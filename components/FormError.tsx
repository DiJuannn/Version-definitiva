"use client";

import { motion } from "motion/react";

// Error de un formulario: role="alert" para que el lector de pantalla lo lea
// en cuanto aparece (antes muchos errores eran un <p> mudo), y una sacudida
// corta y firme — sin rebote: un error no es un juego. Con "reducir
// movimiento" queda solo el texto.
export function FormError({ message, className = "" }: { message: string; className?: string }) {
  return (
    <motion.p
      key={message}
      role="alert"
      initial={{ x: 0 }}
      animate={{ x: [0, -8, 8, -5, 5, 0] }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className={`text-xs text-danger ${className}`}
    >
      {message}
    </motion.p>
  );
}
