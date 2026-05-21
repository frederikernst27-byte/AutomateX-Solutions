/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ["maps.automate-x-solutions.de"] } }
};
export default nextConfig;
