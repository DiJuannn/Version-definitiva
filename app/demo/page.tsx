import type { Metadata } from "next";
import { courierPrime } from "@/lib/screenplay/font";
import { DemoPlayer } from "@/components/demo/DemoPlayer";

export const metadata: Metadata = {
  title: "Demo: del guion al rodaje",
  description: "Dos minutos con el ajolote del Taller: cómo una película pasa del guion al día de rodaje.",
};

// La demo pública del Taller: sin cuenta, con la app de verdad (capturas en
// public/demo/shots) y el ajolote de guía con voz.
export default function DemoPage() {
  return (
    <div className={courierPrime.variable}>
      <DemoPlayer />
    </div>
  );
}
