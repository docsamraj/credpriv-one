import { Router } from 'express';
import { UserRole } from '@credpriv/shared';
import prisma from '../lib/prisma';
import { applicationService } from '../services/application.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler, success, AppError } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('application.read'),
  asyncHandler(async (req, res) => {
    let providerId = req.query.providerId as string | undefined;

    // Providers only see their own applications
    if (req.user!.roles.includes(UserRole.PROVIDER)) {
      const provider = await prisma.provider.findUnique({
        where: { userId: req.user!.userId },
      });
      providerId = provider?.id;
    }

    const apps = await applicationService.list({
      status: req.query.status as string,
      providerId,
      committeeReady: req.query.committeeReady === 'true' ? true : undefined,
    });
    success(res, apps);
  })
);

router.get(
  '/queues',
  requirePermission('application.read'),
  asyncHandler(async (_req, res) => {
    const queues = await applicationService.getStaffQueues();
    success(res, queues);
  })
);

router.post(
  '/',
  requirePermission('application.create'),
  asyncHandler(async (req, res) => {
    let providerId = req.body.providerId as string | undefined;

    if (req.user!.roles.includes(UserRole.PROVIDER)) {
      const provider = await prisma.provider.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!provider) throw new AppError(404, 'Provider profile not found');
      providerId = provider.id;
    }

    if (!providerId) throw new AppError(400, 'providerId is required');

    const app = await applicationService.create(providerId, req.body.type || 'INITIAL_APPOINTMENT');
    success(res, app, 'Application created', 201);
  })
);

router.post(
  '/:id/submit',
  requirePermission('application.update'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.submit(paramId(req.params.id), req);
    success(res, app, 'Application submitted');
  })
);

router.post(
  '/:id/committee-ready',
  requirePermission('committee.mark_ready'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.markCommitteeReady(paramId(req.params.id), req);
    success(res, app, 'Marked committee-ready');
  })
);

export default router;
