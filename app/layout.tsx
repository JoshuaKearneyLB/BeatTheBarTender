import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Baropoly",
  description: "The shift is the board. Sell drinks, roll forward, beat the bar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Baropoly" },
};

export const viewport: Viewport = {
  themeColor: "#14100d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // feels like an app: no pinch-zoom on the tally pad
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
