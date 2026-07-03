import { Router } from 'express';
import { applicationService } from '../services/application.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('application.read'),
  asyncHandler(async (req, res) => {
    const apps = await applicationService.list({
      status: req.query.status as string,
      providerId: req.query.providerId as string,
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
    const app = await applicationService.create(req.body.providerId, req.body.type);
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
