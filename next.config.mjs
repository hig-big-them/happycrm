/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },

  // PWA ve mobile access için cross-origin fix
  allowedDevOrigins: [
    '192.168.30.241:3000',
    'localhost:3000'
  ],

  // Mobile Safari için WebSocket HMR disable
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },

  // Development server ayarları
  experimental: {
    webVitalsAttribution: ['CLS', 'LCP']
  },

  // Gerekirse buraya ek yapılandırmalar eklenebilir
  // Örneğin, experimental özellikler veya domain izinleri
  // experimental: {
  //   serverActions: true,
  // },
}

export default nextConfig 