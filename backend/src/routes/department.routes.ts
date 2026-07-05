import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { departmentService } from '../services/department.service';
import { applicationService } from '../services/application.service';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/pending-approvals',
  requirePermission('department.approve'),
  asyncHandler(async (req, res) => {
    const apps = await departmentService.listPendingApprovals(req.user!.userId);
    success(res, apps);
  })
);

router.get(
  '/my-departments',
  requirePermission('department.approve'),
  asyncHandler(async (req, res) => {
    const depts = await departmentService.getChairedDepartments(req.user!.userId);
    success(res, depts);
  })
);

router.post(
  '/applications/:applicationId/approve',
  requirePermission('department.approve'),
  asyncHandler(async (req, res) => {
    await departmentService.assertChairForApplication(req.user!.userId, paramId(req.params.applicationId));
    const app = await applicationService.approveDepartmentClearance(
      paramId(req.params.applicationId),
      req.user!.userId,
      req
    );
    success(res, app, 'Department approval granted');
  })
);

export default router;
