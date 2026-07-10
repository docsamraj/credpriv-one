import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../middleware/audit';
import { asyncHandler, success, AppError } from '../utils/response';
import { paramId } from '../utils/params';
import { assertCanAccessProvider, getProviderIdForUser, isStaffUser } from '../utils/access';
import { decryptFileToBuffer, encryptFileAtRest } from '../utils/file-crypto';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

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
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Use PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX, or TXT.'));
    }
  },
});

router.use(authenticate);

router.get(
  '/by-provider/:providerId',
  requirePermission('document.read'),
  asyncHandler(async (req, res) => {
    const providerId = paramId(req.params.providerId);
    await assertCanAccessProvider(req, providerId);
    const documents = await prisma.document.findMany({
      where: { providerId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, name: true, type: true, uploadedAt: true, mimeType: true, fileSize: true, isEncrypted: true },
    });
    success(res, documents);
  })
);

router.get(
  '/:id/file',
  requirePermission('document.read'),
  asyncHandler(async (req, res) => {
    const doc = await prisma.document.findUnique({ where: { id: paramId(req.params.id) } });
    if (!doc) throw new AppError(404, 'Document not found');

    if (!isStaffUser(req.user!.roles)) {
      const providerId = await getProviderIdForUser(req.user!.userId);
      if (doc.providerId !== providerId) throw new AppError(403, 'Access denied');
    }

    if (!fs.existsSync(doc.filePath)) throw new AppError(404, 'File not found on server');

    const safeName = doc.name.replace(/[^\w.\-() ]/g, '_');
    const buffer = decryptFileToBuffer(doc.filePath, doc.isEncrypted);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeName)}"`);
    res.send(buffer);
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
      select: {
        id: true,
        name: true,
        type: true,
        uploadedAt: true,
        mimeType: true,
        fileSize: true,
        isEncrypted: true,
      },
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

    const { path: storedPath, encrypted } = encryptFileAtRest(req.file.path);

    const document = await prisma.document.create({
      data: {
        providerId,
        name: docName,
        type: docType,
        filePath: storedPath,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        isEncrypted: encrypted,
      },
    });

    await createAuditLog(
      {
        action: 'CREATE',
        entityType: 'Document',
        entityId: document.id,
        newValue: {
          id: document.id,
          type: document.type,
          name: document.name,
          isEncrypted: document.isEncrypted,
          mimeType: document.mimeType,
        },
      },
      req
    );

    success(
      res,
      {
        id: document.id,
        name: document.name,
        type: document.type,
        uploadedAt: document.uploadedAt,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        isEncrypted: document.isEncrypted,
      },
      'Document uploaded',
      201
    );
  })
);

export default router;
