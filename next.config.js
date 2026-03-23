/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "a.espncdn.com" },
    ],
  },
  env: {
    MM_REGION: process.env.MM_REGION,
    MM_ACCESS_KEY_ID: process.env.MM_ACCESS_KEY_ID,
    MM_SECRET_ACCESS_KEY: process.env.MM_SECRET_ACCESS_KEY,
    TOURNAMENT_ID: process.env.TOURNAMENT_ID,
    // Do not expose NEXTAUTH_SECRET to the browser via env{} — server reads process.env at runtime.
  },
};

module.exports = nextConfig;

