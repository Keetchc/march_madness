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
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
};

module.exports = nextConfig;

