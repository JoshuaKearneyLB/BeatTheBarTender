import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baropoly",
    short_name: "Baropoly",
    description: "The shift is the board. Sell drinks, roll forward, beat the bar.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14100d",
    theme_color: "#14100d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
