import type { Metadata, Viewport } from "next";

import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND.client.name} · Central de despachos`,
  description: `Despachos en vivo — tecnología ${BRAND.platform.name}`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" style={{ "--client": BRAND.client.primary } as React.CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
