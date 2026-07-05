import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { prisma } from './infrastructure/database/prisma';
import { log } from 'node:console';
import { logger } from './infrastructure/logger/logger';

// ─────────────────────────────────────────
// WHY app.ts and server.ts are SEPARATE:
//
// app.ts  → creates and configures the Express app
// server.ts → imports app and starts the HTTP server
//
// This separation exists for ONE reason: TESTING.
//
// In integration tests (Supertest), you need the Express app
// WITHOUT starting the HTTP server:
//
//   import app from './app';
//   import request from 'supertest';
//   request(app).get('/api/v1/health').expect(200);
//
// If app creation and server.listen() were in the same file,
// your tests would start a real server on every test run,
// causing port conflicts and slow test execution.
// ─────────────────────────────────────────

const app: Application = express();

// ─── Security Middleware ───
// helmet() sets 15+ HTTP headers to prevent common attacks:
// X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc.
// In the legacy .NET app, these were manually configured in web.config.
// Helmet does it in one line.
app.use(helmet());

// ─── CORS ───
// Controls which domains can call your API.
// The legacy app had origin: '*' (allow everything) — a security risk.
// We whitelist only our frontend domain.
app.use(cors({
  origin: env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // allows cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
}));

// ─── Body Parsing ───
// express.json() parses JSON request bodies.
// We set a limit to prevent payload DOS attacks.
// The legacy app had no size limit — a production risk.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Compression ───
// Gzip-compresses responses. Reduces payload size by 60-80%.
// In production, Nginx usually handles this, but having it here
// is a defense-in-depth approach.
app.use(compression());

// ─── Request Logging ───
// morgan logs every HTTP request with method, URL, status, response time.
// 'dev' format is colorized for development.
// In production, we'll replace this with Winston structured logging.
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── API Routes ───
// Placeholder: routes will be registered here as we build modules.
// Pattern: app.use('/api/v1/auth', authRoutes);

// ─── Root Health Check ───
// This is NOT the full health check (that comes later with DB checks).
// This just confirms the Express process is alive.
app.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma
    .$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: 'MedClaim API is running',
      database: 'connected',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

// ─── 404 Handler ───
// Catches any request that didn't match a route above.
// Must be AFTER all route definitions.
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${_req.method} ${_req.originalUrl} not found`,
    },
  });
});

// ─── Global Error Handler ───
// Express identifies error handlers by having 4 parameters (err, req, res, next).
// This catches any error thrown or passed via next(error) in any middleware/route.
// The legacy app emailed stack traces to the team — good intent, bad implementation.
// We'll replace this with structured logging + error tracking later.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(`[ERROR] ${err.message}`, err.stack);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
});

export default app;
