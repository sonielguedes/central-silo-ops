/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Remove o header X-Powered-By: Next.js (Lighthouse best-practice)
  poweredByHeader: false,

  typescript: {
    tsconfigPath: './tsconfig.json',
  },

  async headers() {
    /** Headers de segurança aplicados a todas as rotas */
    const securityHeaders = [
      // Impede clickjacking — apenas o próprio site pode fazer framing
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // Impede MIME-type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Controla informações enviadas no Referer
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Desativa recursos de browser não utilizados
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()',
      },
      // Content Security Policy — restringe fontes de conteúdo
      // Ajustar conforme provedores de tiles e scripts externos utilizados
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // Scripts: apenas self + inline necessário para Next.js hydration
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          // Estilos
          "style-src 'self' 'unsafe-inline'",
          // Imagens: self + tiles de mapa + data URIs
          "img-src 'self' data: blob: https://server.arcgisonline.com https://*.arcgisonline.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com",
          // Conexões: self + WebSocket para Next.js HMR em dev
          "connect-src 'self' wss: ws:",
          // Fontes
          "font-src 'self'",
          // Frames: nenhum
          "frame-src 'none'",
          // Workers e blobs para Leaflet
          "worker-src 'self' blob:",
        ].join('; '),
      },
    ];

    // Em produção, adiciona HSTS (Strict-Transport-Security)
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        // Aplicar headers de segurança em TODAS as rotas
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Cache imutavel de longo prazo para assets estaticos gerados pelo Next.js.
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
