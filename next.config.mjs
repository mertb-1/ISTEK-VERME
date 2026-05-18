/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse'ı webpack bundle'ından çıkar; Node.js runtime'da native require kullanılır
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
