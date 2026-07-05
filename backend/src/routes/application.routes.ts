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
      workflowPhase: req.query.workflowPhase as string | undefined,
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

    const app = await applicationService.create(providerId, req.body.type || 'INITIAL_APPOINTMENT', {
      staffCategoryId: req.body.staffCategoryId,
      staffSubtypeId: req.body.staffSubtypeId,
      jobDescriptionId: req.body.jobDescriptionId,
      clinicalUnit: req.body.clinicalUnit,
    });
    success(res, app, 'Application created', 201);
  })
);

router.get(
  '/:id',
  requirePermission('application.read'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.getById(paramId(req.params.id));
    success(res, app);
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

router.post(
  '/:id/complete-credentialing',
  requirePermission('committee.mark_ready'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.completeCredentialing(paramId(req.params.id), req);
    success(res, app, 'Credentialing complete — provider can request privileges');
  })
);

router.put(
  '/:id/privilege-requests',
  requirePermission('application.update'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.savePrivilegeRequests(
      paramId(req.params.id),
      req.body.requests || []
    );
    success(res, app, 'Privilege requests saved');
  })
);

router.post(
  '/:id/submit-privileges',
  requirePermission('application.update'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.submitPrivileges(paramId(req.params.id), req);
    success(res, app, 'Privileges submitted for committee review');
  })
);

router.post(
  '/:id/grant-privileges',
  requirePermission('committee.decide'),
  asyncHandler(async (req, res) => {
    const app = await applicationService.grantPrivileges(
      paramId(req.params.id),
      req.body.grants || [],
      req.user!.userId,
      req
    );
    success(res, app, 'Privileges granted');
  })
);

export default router;
