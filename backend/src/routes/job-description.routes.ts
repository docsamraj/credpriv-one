import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { jobDescriptionService } from '../services/job-description.service';
import { jobDescriptionParserService } from '../modules/ai/job-description-parser';
import { isSupportedJobDescriptionFile } from '../modules/ai/document-text';
import { asyncHandler, success, AppError } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

const uploadDir = process.env.JD_UPLOAD_DIR || path.join(process.env.UPLOAD_DIR || './uploads', 'job-descriptions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isSupportedJobDescriptionFile(file.originalname, file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Use PDF, DOCX, XLSX, TXT, or CSV.'));
    }
  },
});

router.use(authenticate);
router.use(requirePermission('job_description.manage'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await jobDescriptionService.list({
      subtypeId: req.query.subtypeId as string | undefined,
      categoryId: req.query.categoryId as string | undefined,
    });
    success(res, list);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const jd = await jobDescriptionService.getById(paramId(req.params.id));
    success(res, jd);
  })
);

router.post(
  '/parse',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'No file uploaded');

    const subtypeId = (req.body.staffSubtypeId as string | undefined)?.trim();
    let subtype =
      subtypeId
        ? await prisma.staffSubtype.findUnique({
            where: { id: subtypeId },
            include: { category: true },
          })
        : null;

    let appliedSuggestion = false;

    // If no role selected, detect from document text first
    if (!subtype) {
      const { extractTextFromFile } = await import('../modules/ai/document-text');
      const text = await extractTextFromFile(req.file.path, req.file.mimetype);
      if (!text.trim()) {
        throw new AppError(400, 'Could not extract text from the uploaded file. Try a text-based PDF or DOCX.');
      }
      const suggestion = await jobDescriptionParserService.suggestRoleFromText(text);
      if (suggestion) {
        const suggested = await prisma.staffSubtype.findFirst({
          where: {
            code: suggestion.subtypeCode,
            category: { code: suggestion.categoryCode },
          },
          include: { category: true },
        });
        if (suggested) {
          subtype = suggested;
          appliedSuggestion = true;
          if (!req.body.clinicalUnit && suggestion.clinicalUnit) {
            req.body.clinicalUnit = suggestion.clinicalUnit;
          }
        }
      }
    }

    if (!subtype) {
      throw new AppError(
        400,
        'Could not detect staff role from the document. Select category and role, then upload again.'
      );
    }

    const result = await jobDescriptionParserService.parseUploadedFile({
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      roleName: subtype.name,
      categoryName: subtype.category.name,
      clinicalUnit: req.body.clinicalUnit as string | undefined,
      titleHint: req.body.title as string | undefined,
      suggestRole: true,
    });

    success(res, {
      title: result.title,
      clinicalUnit: result.clinicalUnit,
      items: result.items,
      extractedTextPreview: result.extractedTextPreview,
      parsedBy: result.parsedBy,
      sourceFileName: req.file.originalname,
      sourceFilePath: req.file.path,
      sourceMimeType: req.file.mimetype,
      staffSubtypeId: subtype.id,
      staffCategoryId: subtype.categoryId,
      suggestedCategoryCode: result.suggestedCategoryCode,
      suggestedSubtypeCode: result.suggestedSubtypeCode,
      suggestedClinicalUnit: result.suggestedClinicalUnit,
      suggestionConfidence: result.suggestionConfidence,
      suggestionSource: result.suggestionSource,
      suggestionReason: result.suggestionReason,
      appliedSuggestion,
    });
  })
);

router.post(
  '/publish',
  asyncHandler(async (req, res) => {
    const {
      staffCategoryId,
      staffSubtypeId,
      clinicalUnit,
      title,
      description,
      items,
      sourceFileName,
      sourceFilePath,
      sourceMimeType,
      extractedTextPreview,
    } = req.body;

    if (!staffCategoryId || !staffSubtypeId || !title) {
      throw new AppError(400, 'staffCategoryId, staffSubtypeId, and title are required');
    }

    const jd = await jobDescriptionService.publish({
      categoryId: staffCategoryId,
      subtypeId: staffSubtypeId,
      clinicalUnit,
      title,
      description,
      items: items || [],
      sourceFileName,
      sourceFilePath,
      sourceMimeType,
      extractedText: extractedTextPreview,
    });

    success(res, jd, 'Job description published', 201);
  })
);

export default router;
