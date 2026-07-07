import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '@/infrastructure/logger/logger';

export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, string> = {};

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['postgresql'] = 'connected';
  } catch {
    checks['postgresql'] = 'disconnected';
  }

  const isHealthy = Object.values(checks).every(
    (status) => status === 'connected',
  );

  if (!isHealthy) {
    logger.warn('Health check failed', { checks });
  }

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  });
};