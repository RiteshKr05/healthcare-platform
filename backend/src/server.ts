import app from './app';
import { env } from './config/env';
import { logger } from './infrastructure/logger/logger';


const PORT = env.PORT;
const APP_NAME = env.APP_NAME;

// ─── Start Server ───
const server = app.listen(PORT, () => {
  logger.info(`${env.APP_NAME} running on port ${env.PORT} [${env.NODE_ENV}]`);
});

// ─── Graceful Shutdown ───
// When the process receives SIGTERM (Docker stop) or SIGINT (Ctrl+C),
// we close the server gracefully instead of killing connections mid-request.
//
// Why this matters:
// - In Docker/Kubernetes, a SIGTERM is sent before a container is killed
// - Without this handler, active requests get dropped
// - In production, you'd also close DB connections, flush logs, etc.
//
// The legacy .NET app had no graceful shutdown — requests would fail
// during deployments.

const gracefulShutdown = (signal: string) => {
  logger.info(`\n[${signal}] Shutting down gracefully...`);

  server.close(() => {
    logger.info('[SERVER] HTTP server closed');
    // Future: close Prisma, MongoDB, Redis connections here
    process.exit(0);
  });

  // Force kill after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('[SERVER] Forced shutdown — graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Catch Unhandled Errors ───
// These should NEVER happen if our error handling is correct,
// but they're a safety net to prevent the process from crashing silently.
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // In production: log to error tracking service, then shutdown
});

process.on('uncaughtException', (error: Error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  // Uncaught exceptions leave the process in an undefined state.
  // The only safe thing to do is log and exit.
  logger.error('[UNCAUGHT EXCEPTION]', error);
  process.exit(1);
});

export default server;
