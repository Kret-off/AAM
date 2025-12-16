/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Add any experimental features if needed
  },
  // Increase body size limit for large file uploads (1.2GB max)
  serverRuntimeConfig: {
    maxFileSize: 1200000000, // 1.2GB in bytes
  },
  // Disable body parsing for API routes that handle file uploads
  api: {
    bodyParser: {
      sizeLimit: '1.2gb',
    },
  },
};

module.exports = nextConfig;








