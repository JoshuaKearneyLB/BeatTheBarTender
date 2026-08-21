import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

// Committed woff2 files — builds never touch the network for type.
const display = localFont({
  src: "../public/fonts/BebasNeue-Regular.woff2",
  variable: "--font-display",
  display: "swap",
});
const chalk = localFont({
  src: "../public/fonts/Caveat-Bold.woff2",
  variable: "--font-chalk",
  display: "swap",
});

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
      <body className={`${display.variable} ${chalk.variable} min-h-dvh`}>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
