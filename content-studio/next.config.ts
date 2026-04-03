import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent folder has its own package-lock (npm run dev from repo root). Pin Turbopack to this app.
  turbopack: {
    root: appDir,
  },
};

export default nextConfig;
