import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Sistema de diseño (Mesa de luz): los componentes base de components/ui
  // usan tokens, no valores sueltos. Aviso (no error) para tamaños, sombras,
  // radios y colores escritos a mano en las clases.
  {
    files: ["components/ui/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/(^|\\s)(text|shadow|rounded)-\\[/]",
          message: "Usa un token del sistema (escala tipográfica, --shadow-*, --r-*) en vez de un valor suelto.",
        },
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/]",
          message: "Usa un token de color (bg-ink-*, text-gel, var(--…)) en vez de un hex suelto.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/generated/**",
    // Scripts de herramientas sueltas (Node CommonJS), no son parte de la
    // app ni se compilan con Next.js.
    "scripts/**",
  ]),
]);

export default eslintConfig;
