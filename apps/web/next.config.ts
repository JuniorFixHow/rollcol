import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rollcol/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every RollCol page depends on who is signed in, so pages cannot be
    // prepared in advance. Only check pages that ask for it with `instant`.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
