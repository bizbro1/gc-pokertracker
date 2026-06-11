import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GC PokerTracker",
    short_name: "PokerTracker",
    description:
      "Gentleman's Club poker session tracker — buy-ins, chips, blinds and P/L.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0907",
    theme_color: "#0b0907",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
