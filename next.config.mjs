/** @type {import('next').NextConfig} */

// Static export: the whole site is rendered at build time from
// data/articles.json. No server, no database — the collector runs on a
// schedule and the build turns its output into flat HTML.
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Set BASE_PATH when hosting under a subpath (e.g. GitHub Pages project site).
  basePath: process.env.BASE_PATH || "",
};

export default nextConfig;
