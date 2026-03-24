/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pull next-auth through the compiler so server chunks stay coherent (helps avoid missing vendor-chunks).
  transpilePackages: ["next-auth", "@next-auth/dynamodb-adapter"],
  /**
   * Externalize AWS SDK + Smithy only. Do not externalize next-auth — Next's server runtime
   * resolves those as "native" externals and throws (e.g. Native module not found: next-auth/jwt).
   */
  webpack: (config, { isServer }) => {
    if (!isServer) return config;

    function awsSmithyExternal(ctx, callback) {
      const request = typeof ctx === "string" ? ctx : ctx?.request;
      if (
        request &&
        (request.startsWith("@aws-sdk/") || request.startsWith("@smithy/"))
      ) {
        return callback(undefined, `commonjs ${request}`);
      }
      callback();
    }

    // Next keeps server `externals` as an array of resolvers; only extend that shape.
    if (Array.isArray(config.externals)) {
      config.externals.push(awsSmithyExternal);
    }

    return config;
  },
  images: {
    remotePatterns: [
      // Google profile photos rotate across lh* hosts; only listing lh3 breaks Next/Image + optimizer.
      ...["lh3", "lh4", "lh5", "lh6", "lh7"].map((h) => ({
        protocol: "https",
        hostname: `${h}.googleusercontent.com`,
      })),
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
