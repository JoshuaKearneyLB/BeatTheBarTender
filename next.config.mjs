/** @type {import('next').NextConfig} */
const nextConfig = {
  // Receipt photos come back from Supabase Storage
  // The specs test used to be a standalone page; old links land on the new one.
  async redirects() {
    return [
      { source: "/training", destination: "/specs", permanent: true },
      { source: "/training/:path*", destination: "/specs", permanent: true },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
