import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "조각",
    short_name: "조각",
    description: "조각 서비스 웹앱입니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#090b1b",
    theme_color: "#090b1b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
