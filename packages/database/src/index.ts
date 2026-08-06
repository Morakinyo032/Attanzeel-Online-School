import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'
import path from 'path'

// Load .env from the database package
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const globalForPrisma = global as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Check your .env file.')
  }
  
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  })

  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'