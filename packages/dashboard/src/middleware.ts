import { withAuth } from 'next-auth/middleware'

/**
 * Middleware protecting all dashboard routes.
 * Redirects unauthenticated users to /login.
 */
export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  // Protect everything except /login, /api/auth/*, and static assets
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
