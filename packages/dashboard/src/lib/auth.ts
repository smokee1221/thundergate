import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { db, operators } from '@thundergate/db'

/**
 * SHA-256 hash for comparing credentials.
 * Note: upgrade to bcrypt for production deployments.
 */
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const [operator] = await db
          .select({
            id: operators.id,
            email: operators.email,
            name: operators.name,
            role: operators.role,
            passwordHash: operators.passwordHash,
            isActive: operators.isActive,
          })
          .from(operators)
          .where(eq(operators.email, credentials.email))
          .limit(1)

        if (!operator || !operator.isActive) {
          return null
        }

        // Compare password hash (SHA-256 for dev — upgrade to bcrypt for production)
        const hash = sha256(credentials.password)
        if (hash !== operator.passwordHash) {
          return null
        }

        // Update last login
        await db
          .update(operators)
          .set({ lastLoginAt: new Date() })
          .where(eq(operators.id, operator.id))

        return {
          id: operator.id,
          email: operator.email,
          name: operator.name,
          role: operator.role as 'ADMIN' | 'OPERATOR' | 'VIEWER',
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
  secret:
    process.env.TG_NEXTAUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    'dev-secret-change-in-production',
}
