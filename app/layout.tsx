import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { MotionProvider } from "@/components/MotionProvider";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  // Ancho variable: la letra condensada de cartel (títulos de proyecto).
  axes: ["wdth"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Dígitos de siete segmentos (DSEG7, licencia OFL): el reloj de la claqueta y
// del día de rodaje. Solo números, por eso pesa 5 KB.
const seg = localFont({
  src: "./fonts/DSEG7Classic-Bold.woff2",
  variable: "--font-seg",
  weight: "700",
  display: "block",
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Versión definitiva — Productora audiovisual";
const description =
  "Productora audiovisual. Contamos historias en imagen, de la idea al montaje final: ficción, publicidad, documental y corporativo.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s — Versión definitiva",
  },
  description,
  keywords: [
    "productora audiovisual",
    "producción de vídeo",
    "cortometrajes",
    "publicidad audiovisual",
    "documental",
  ],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: siteUrl,
    siteName: "Versión definitiva",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${jetbrainsMono.variable} ${seg.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-fg font-sans relative">
        {/* Primer elemento con foco: con teclado o lector de pantalla se salta la navegación. */}
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {/* Sin JavaScript, lo que aparece con una animación de entrada
            (Reveal, Dashboard*) se quedaría invisible: se enseña tal cual. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 opacity-[0.06] mix-blend-screen"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
