import { Router } from 'express';
import { providerService } from '../services/provider.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('provider.read'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const result = await providerService.list(page, pageSize, {
      departmentId: req.query.departmentId as string,
      search: req.query.search as string,
    });
    success(res, result);
  })
);

router.get(
  '/:id',
  requirePermission('provider.read'),
  asyncHandler(async (req, res) => {
    const provider = await providerService.getById(paramId(req.params.id));
    success(res, provider);
  })
);

router.patch(
  '/:id/profile',
  requirePermission('profile.update'),
  asyncHandler(async (req, res) => {
    const profile = await providerService.updateProfile(paramId(req.params.id), req.body, req);
    success(res, profile);
  })
);

export default router;
