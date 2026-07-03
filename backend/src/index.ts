import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import { errorHandler } from './utils/response';
import prisma from './lib/prisma';
import authRoutes from './routes/auth.routes';
import providerRoutes from './routes/provider.routes';
import applicationRoutes from './routes/application.routes';
import credentialRoutes from './routes/credential.routes';
import committeeRoutes from './routes/committee.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminRoutes from './routes/admin.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check — required for Railway
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'credpriv-one-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Database connectivity check — use for smoke tests
app.get('/health/db', async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ status: 'error', database: 'DATABASE_URL not configured' });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    return res.status(200).json({ status: 'ok', database: 'connected', users: userCount });
  } catch (error) {
    console.error('Database health check failed:', error);
    return res.status(503).json({
      status: 'error',
      database: 'unreachable',
      hint: 'Check DATABASE_URL and run: npx prisma migrate deploy && npx tsx prisma/seed.ts',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/committees', committeeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    try {
      console.log('Running database migrations...');
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: process.env,
      });
      console.log('Migrations applied successfully.');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  } else {
    console.warn('WARNING: DATABASE_URL is not set — link Postgres in Railway Variables');
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CredPriv One API running on 0.0.0.0:${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
