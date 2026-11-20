import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RollCol",
    short_name: "RollCol",
    description: "Attendance for schools: registers, parent alerts and self check-in.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#0f6b62",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
