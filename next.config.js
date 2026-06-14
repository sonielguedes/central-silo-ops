/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Remove o header X-Powered-By: Next.js (Lighthouse best-practice)
  poweredByHeader: false,

  typescript: {
    tsconfigPath: './tsconfig.json',
  },

  async headers() {
    return [
      {
        // Cache imutavel de longo prazo para assets estaticos gerados pelo Next.js.
        // O proprio Next.js ja faz isso internamente; declarar aqui garante que
        // camadas intermediarias (CDN, nginx upstream) tambem recebam o header.
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Fontes e imagens publicas: cache longo, mas revalidavel
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
