import { Router } from 'express';
import { catalogService } from '../services/catalog.service';
import { authenticate } from '../middleware/auth';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await catalogService.listCategories();
    success(res, categories);
  })
);

router.get(
  '/clinical-units/:subtypeId',
  asyncHandler(async (req, res) => {
    const units = await catalogService.listClinicalUnits(paramId(req.params.subtypeId));
    success(res, units);
  })
);

router.get(
  '/job-descriptions/:subtypeId',
  asyncHandler(async (req, res) => {
    const jd = await catalogService.getJobDescription(
      paramId(req.params.subtypeId),
      req.query.clinicalUnit as string | undefined
    );
    success(res, jd);
  })
);

router.get(
  '/required-documents',
  asyncHandler(async (req, res) => {
    const docs = await catalogService.getRequiredDocuments(
      req.query.categoryId as string | undefined,
      req.query.subtypeId as string | undefined
    );
    success(res, docs);
  })
);

export default router;
