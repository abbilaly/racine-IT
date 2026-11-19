import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev({ configPath: "./freebuff.wrangler.jsonc" });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloud preview hostnames are per-VM, so the dev origin is supplied by the
  // environment instead of being committed.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGIN ? [process.env.ALLOWED_DEV_ORIGIN] : []
};

export default nextConfig;
