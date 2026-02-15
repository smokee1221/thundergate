/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@thundergate/db'],
  // Map TG_-prefixed env vars to what NextAuth expects
  env: {
    NEXTAUTH_URL:
      process.env.TG_NEXTAUTH_URL ??
      process.env.NEXTAUTH_URL ??
      'http://localhost:3000',
    NEXTAUTH_SECRET:
      process.env.TG_NEXTAUTH_SECRET ??
      process.env.NEXTAUTH_SECRET ??
      'dev-secret-change-in-production',
  },
}

export default nextConfig
