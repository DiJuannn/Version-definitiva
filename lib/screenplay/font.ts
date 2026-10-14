import { Courier_Prime } from "next/font/google";

// Courier Prime: la Courier de los guiones, pensada para pantalla. Mismo
// ancho de carácter que la Courier del PDF, así la página se ve igual.
export const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-courier",
});
