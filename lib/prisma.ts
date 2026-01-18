import { PrismaClient } from '@prisma/client'

/**
 * Client Prisma singleton pour éviter les connexions multiples en développement
 * Next.js hot-reload crée de nouvelles instances, ce pattern évite les fuites de connexion
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
