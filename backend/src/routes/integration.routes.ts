import { Router } from 'express';
import { integrationAuth } from '../middleware/security';
import { requirePermission } from '../middleware/rbac';
import { dataExportService } from '../services/data-export.service';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(integrationAuth);

router.get(
  '/systems',
  requirePermission('integration.read'),
  asyncHandler(async (_req, res) => {
    const systems = await dataExportService.listIntegrationSystems();
    success(res, systems);
  })
);

router.get(
  '/providers/:id/export',
  requirePermission('integration.export'),
  asyncHandler(async (req, res) => {
    const bundle = await dataExportService.exportProviderBundle(
      paramId(req.params.id),
      req.user?.userId,
      req
    );
    success(res, bundle);
  })
);

router.get(
  '/applications/:id/export',
  requirePermission('integration.export'),
  asyncHandler(async (req, res) => {
    const packet = await dataExportService.exportApplicationPacket(
      paramId(req.params.id),
      req.user?.userId,
      req
    );
    success(res, packet);
  })
);

router.post(
  '/external-ids',
  requirePermission('integration.admin'),
  asyncHandler(async (req, res) => {
    const record = await dataExportService.upsertExternalIdentifier({
      systemCode: req.body.systemCode,
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      externalId: req.body.externalId,
    });
    success(res, record, 'External identifier mapped', 201);
  })
);

export default router;
