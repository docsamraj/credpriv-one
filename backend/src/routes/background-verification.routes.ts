import { Router } from 'express';
import { backgroundVerificationService } from '../services/background-verification.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/third-parties',
  requirePermission('verification.create'),
  asyncHandler(async (_req, res) => {
    const agencies = await backgroundVerificationService.listThirdPartyVerifiers();
    success(res, agencies);
  })
);

router.post(
  '/third-parties',
  requirePermission('verification.update'),
  asyncHandler(async (req, res) => {
    const agency = await backgroundVerificationService.createThirdPartyVerifier(req.body, req);
    success(res, agency, 'Third-party verifier registered', 201);
  })
);

router.get(
  '/application/:applicationId',
  requirePermission('application.read'),
  asyncHandler(async (req, res) => {
    const records = await backgroundVerificationService.listByApplication(
      paramId(req.params.applicationId)
    );
    success(res, records);
  })
);

router.post(
  '/application/:applicationId',
  requirePermission('verification.create'),
  asyncHandler(async (req, res) => {
    const record = await backgroundVerificationService.create(
      paramId(req.params.applicationId),
      req.body,
      req.user!.userId,
      req
    );
    success(res, record, 'Background verification recorded', 201);
  })
);

router.patch(
  '/:id',
  requirePermission('verification.update'),
  asyncHandler(async (req, res) => {
    const record = await backgroundVerificationService.update(paramId(req.params.id), req.body, req);
    success(res, record, 'Background verification updated');
  })
);

export default router;
