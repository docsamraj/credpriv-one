import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../middleware/audit';
import { asyncHandler, success, AppError } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
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
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

async function getProviderIdForUser(userId: string): Promise<string> {
  const provider = await prisma.provider.findUnique({ where: { userId } });
  if (!provider) throw new AppError(404, 'Provider profile not found');
  return provider.id;
}

router.get(
  '/by-provider/:providerId',
  requirePermission('document.read'),
  asyncHandler(async (req, res) => {
    const providerId = paramId(req.params.providerId);
    const documents = await prisma.document.findMany({
      where: { providerId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, name: true, type: true, uploadedAt: true, mimeType: true, fileSize: true },
    });
    success(res, documents);
  })
);

router.get(
  '/my',
  requirePermission('document.read'),
  asyncHandler(async (req, res) => {
    const providerId = await getProviderIdForUser(req.user!.userId);
    const documents = await prisma.document.findMany({
      where: { providerId },
      orderBy: { uploadedAt: 'desc' },
    });
    success(res, documents);
  })
);

router.post(
  '/upload',
  requirePermission('document.upload'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'No file uploaded');

    const providerId = await getProviderIdForUser(req.user!.userId);
    const docType = (req.body.type as string) || 'OTHER';
    const docName = (req.body.name as string) || req.file.originalname;

    const document = await prisma.document.create({
      data: {
        providerId,
        name: docName,
        type: docType,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });

    await createAuditLog(
      { action: 'CREATE', entityType: 'Document', entityId: document.id, newValue: document },
      req
    );

    success(res, document, 'Document uploaded', 201);
  })
);

export default router;
