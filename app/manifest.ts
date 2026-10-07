import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baropoly",
    short_name: "Baropoly",
    description: "Tonight's drink race. Pick a drink, set a number, first behind the bar to sell it wins.",
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
