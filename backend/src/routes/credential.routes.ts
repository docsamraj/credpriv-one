import { Router } from 'express';
import { credentialService, verificationService } from '../services/credential.service';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/provider/:providerId',
  requirePermission('credential.read'),
  asyncHandler(async (req, res) => {
    const providerId = paramId(req.params.providerId);
    const { assertCanAccessProvider } = await import('../utils/access');
    await assertCanAccessProvider(req, providerId);
    const credentials = await credentialService.listByProvider(providerId);
    success(res, credentials);
  })
);

router.post(
  '/',
  requirePermission('credential.update'),
  asyncHandler(async (req, res) => {
    const credential = await credentialService.create(req.body.providerId, req.body, req);
    success(res, credential, 'Credential created', 201);
  })
);

router.patch(
  '/:id/status',
  requirePermission('credential.verify'),
  asyncHandler(async (req, res) => {
    const credential = await credentialService.updateStatus(paramId(req.params.id), req.body.status, req);
    success(res, credential);
  })
);

router.get(
  '/expiring/:days',
  requirePermission('credential.read'),
  asyncHandler(async (req, res) => {
    const days = parseInt(paramId(req.params.days)) || 30;
    const credentials = await credentialService.getExpiring(days);
    success(res, credentials);
  })
);

// Verification requests
router.get(
  '/verifications/pending',
  requirePermission('verification.create'),
  asyncHandler(async (_req, res) => {
    const pending = await verificationService.listPending();
    success(res, pending);
  })
);

router.post(
  '/verifications',
  requirePermission('verification.create'),
  asyncHandler(async (req, res) => {
    const verification = await verificationService.create(req.body.credentialId, req.body.source);
    success(res, verification, 'Verification request created', 201);
  })
);

router.patch(
  '/verifications/:id',
  requirePermission('verification.update'),
  asyncHandler(async (req, res) => {
    const verification = await verificationService.complete(
      paramId(req.params.id),
      req.user!.userId,
      req.body.status,
      req.body.remarks,
      req
    );
    success(res, verification);
  })
);

export default router;
