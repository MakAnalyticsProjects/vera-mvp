import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton. The `globalThis.__prisma` cache prevents Next.js
 * dev hot-reload from creating a new client per reload (which exhausts
 * connection pools quickly). In production each Vercel function instance
 * gets its own.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db;
}
