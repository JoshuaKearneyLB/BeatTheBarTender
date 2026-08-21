/** @type {import('next').NextConfig} */
const nextConfig = {
  // Receipt photos come back from Supabase Storage
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
