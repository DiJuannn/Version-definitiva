import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Archivo({ variable: "--ff-display", subsets: ["latin"], axes: ["wdth"] });
const body = Instrument_Sans({ variable: "--ff-body", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--ff-code", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Corte", template: "%s · Corte" },
  description: "Sala de trabajo de la agencia: proyectos, montajes, revisión y entregas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#eceef1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
