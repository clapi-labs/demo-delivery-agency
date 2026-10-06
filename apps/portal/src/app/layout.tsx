import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLAPI Dispatch — Centro de control",
  description: "Viajes, flota y arqueo en vivo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
