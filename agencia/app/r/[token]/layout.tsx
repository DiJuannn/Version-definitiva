import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revisión compartida", robots: { index: false, follow: false } };

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}
