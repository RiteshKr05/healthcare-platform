import dotenv from 'dotenv';

// ─── Load environment variables FIRST ───
// This must happen before importing app.ts or anything else,
// because those modules may read process.env at import time.
// Order matters: dotenv → then everything else.
dotenv.config();

import app from './app';

const PORT = parseInt(process.env.PORT || '5000', 10);
const APP_NAME = process.env.APP_NAME || 'MedClaim API';

// ─── Start Server ───
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║                                              ║
  ║   ${APP_NAME}                        ║
  ║                                              ║
  ║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(28)}║
  ║   Port:        ${String(PORT).padEnd(28)}║
  ║   URL:         http://localhost:${String(PORT).padEnd(14)}║
  ║                                              ║
  ╚══════════════════════════════════════════════╝
  `);
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
  console.log(`\n[${signal}] Shutting down gracefully...`);

  server.close(() => {
    console.log('[SERVER] HTTP server closed');
    // Future: close Prisma, MongoDB, Redis connections here
    process.exit(0);
  });

  // Force kill after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown — graceful shutdown timed out');
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
  process.exit(1);
});

export default server;
