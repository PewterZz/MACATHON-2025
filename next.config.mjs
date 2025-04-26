/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      worker_threads: false,
      path: false,
      timers: false,
      'timers/promises': false,
      zlib: false,
      'zlib-sync': false,
      crypto: false,
      fs: false,
      http: false,
      https: false,
      os: false,
      net: false,
      tls: false,
      child_process: false,
      stream: false,
      url: false,
      util: false,
      buffer: false,
      querystring: false,
    };
    return config;
  },
}

export default nextConfig
