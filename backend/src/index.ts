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
import documentRoutes from './routes/document.routes';
import catalogRoutes from './routes/catalog.routes';
import jobDescriptionRoutes from './routes/job-description.routes';
import integrationRoutes from './routes/integration.routes';
import backgroundVerificationRoutes from './routes/background-verification.routes';
import notificationRoutes from './routes/notification.routes';
import departmentRoutes from './routes/department.routes';
import { seedStaffCatalog } from './lib/seed-staff-catalog';
import { securityHeaders } from './middleware/security';
import { runCredentialExpiryReminders } from './jobs/credential-expiry.job';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
app.use('/api/documents', documentRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/job-descriptions', jobDescriptionRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/background-verifications', backgroundVerificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/department', departmentRoutes);

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

      try {
        const categoryCount = await prisma.staffCategory.count();
        if (categoryCount === 0) {
          console.log('Staff catalog empty — seeding categories, roles, and job descriptions...');
          await seedStaffCatalog(prisma);
          console.log('Staff catalog seeded.');
        }
      } catch (seedErr) {
        console.warn('Staff catalog bootstrap skipped (run migrate deploy first):', seedErr);
      }
    } catch (error) {
      console.error('Migration failed:', error);
    }
  } else {
    console.warn('WARNING: DATABASE_URL is not set — link Postgres in Railway Variables');
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`CredPriv One API running on 0.0.0.0:${PORT}`);
    console.log(`Health check: http://0.0.0.0:${PORT}/health`);

    if (process.env.ENABLE_EXPIRY_REMINDERS !== 'false' && process.env.DATABASE_URL) {
      const dayMs = 24 * 60 * 60 * 1000;
      setTimeout(() => runCredentialExpiryReminders().catch((e) => console.error('Expiry reminder job failed:', e)), 30000);
      setInterval(() => runCredentialExpiryReminders().catch((e) => console.error('Expiry reminder job failed:', e)), dayMs);
      console.log('Credential expiry reminder job scheduled (daily).');
    }
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
