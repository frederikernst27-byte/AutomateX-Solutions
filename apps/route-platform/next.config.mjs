import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    // `next build` and `next dev` must not write into the same directory. A
    // production build during local development otherwise removes active dev
    // chunks and leaves the rendered UI without React click handlers.
    distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
    output: "standalone",
    outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
    reactStrictMode: true,
    experimental: { optimizePackageImports: ["lucide-react"] },
  };
}
