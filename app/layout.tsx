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
  description: "Tonight's drink race. Pick a drink, set a number, first behind the bar to sell it wins.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Baropoly" },
};

export const viewport: Viewport = {
  themeColor: "#14100d",
  width: "device-width",
  initialScale: 1,
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
