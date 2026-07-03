import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { analyticsService } from '../services/analytics.service';
import { asyncHandler, success } from '../utils/response';

const router = Router();

router.use(authenticate);
router.use(requirePermission('analytics.read'));

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const overview = await analyticsService.getOverview();
    success(res, overview);
  })
);

router.get(
  '/turnaround',
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.turnaroundByStage();
    success(res, data);
  })
);

router.get(
  '/trends',
  asyncHandler(async (req, res) => {
    const months = parseInt(req.query.months as string) || 6;
    const trends = await analyticsService.monthlyTrends(months);
    success(res, trends);
  })
);

router.get(
  '/bottlenecks',
  asyncHandler(async (_req, res) => {
    const bottlenecks = await analyticsService.bottlenecks();
    success(res, bottlenecks);
  })
);

router.get(
  '/pending-by-department',
  asyncHandler(async (_req, res) => {
    const data = await analyticsService.pendingByDepartment();
    success(res, data);
  })
);

export default router;
