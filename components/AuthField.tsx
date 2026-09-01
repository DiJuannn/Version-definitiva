"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/ToolIcons";

export function AuthField({
  label,
  name,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label
        htmlFor={name}
        className="block font-mono text-xs tracking-widest text-muted uppercase"
      >
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={name}
          name={name}
          type={isPassword && visible ? "text" : type}
          required={required}
          autoComplete={autoComplete}
          className={`w-full border border-line bg-transparent px-3 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent ${
            isPassword ? "pr-10" : ""
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition-colors hover:text-accent"
          >
            {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
