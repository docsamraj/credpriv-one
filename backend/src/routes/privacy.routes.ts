import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { createAuditLog } from '../middleware/audit';
import { asyncHandler, success, AppError } from '../utils/response';
import { PRIVACY_NOTICE_VERSION } from '../services/auth.service';

const router = Router();

router.use(authenticate);

/** Data principal — export own personal data (DPDP access right) */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        provider: {
          include: {
            profile: true,
            applications: { select: { id: true, type: true, status: true, workflowPhase: true, submittedAt: true, createdAt: true } },
            credentials: { select: { id: true, type: true, title: true, status: true, expiryDate: true } },
            documents: { select: { id: true, name: true, type: true, uploadedAt: true, mimeType: true, isEncrypted: true } },
          },
        },
        notifications: { take: 50, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, createdAt: true, isRead: true } },
      },
    });
    if (!user) throw new AppError(404, 'User not found');

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      principal: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map((r) => r.role),
        consentAt: user.consentAt,
        consentVersion: user.consentVersion,
        privacyNoticeAccepted: user.privacyNoticeAccepted,
      },
      provider: user.provider
        ? {
            id: user.provider.id,
            licenseNo: user.provider.licenseNo,
            profile: user.provider.profile,
            applications: user.provider.applications,
            credentials: user.provider.credentials,
            documents: user.provider.documents,
          }
        : null,
      recentNotifications: user.notifications,
    };

    await createAuditLog(
      { action: 'EXPORT', entityType: 'User', entityId: userId, metadata: { purpose: 'DPDP_DATA_PRINCIPAL_ACCESS' } },
      req
    );

    success(res, exportPayload);
  })
);

/** Record / refresh consent */
router.post(
  '/consent',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        privacyNoticeAccepted: true,
        consentAt: new Date(),
        consentVersion: PRIVACY_NOTICE_VERSION,
      },
    });
    await createAuditLog(
      { action: 'UPDATE', entityType: 'User', entityId: user.id, metadata: { action: 'consent_recorded', version: PRIVACY_NOTICE_VERSION } },
      req
    );
    success(res, {
      privacyNoticeAccepted: true,
      consentAt: user.consentAt,
      consentVersion: user.consentVersion,
    });
  })
);

/** Request erasure (soft) — staff completes after review */
router.post(
  '/erase-request',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { erasureRequestedAt: new Date() },
    });
    await createAuditLog(
      { action: 'UPDATE', entityType: 'User', entityId: user.id, metadata: { action: 'erasure_requested' } },
      req
    );
    success(res, {
      erasureRequestedAt: user.erasureRequestedAt,
      message: 'Erasure request recorded. Credentialing staff will process it per retention policy and legal holds.',
    });
  })
);

/** Staff: list pending erasure requests */
router.get(
  '/erasure-requests',
  requirePermission('audit.read'),
  asyncHandler(async (_req, res) => {
    const items = await prisma.user.findMany({
      where: { erasureRequestedAt: { not: null }, erasureCompletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        erasureRequestedAt: true,
        createdAt: true,
      },
      orderBy: { erasureRequestedAt: 'asc' },
    });
    success(res, items);
  })
);

/** Staff: complete erasure — anonymize PII, deactivate, keep audit trail */
router.post(
  '/erasure-requests/:userId/complete',
  requirePermission('audit.read'),
  asyncHandler(async (req, res) => {
    const userId = req.params.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { provider: { include: { documents: true } } },
    });
    if (!user) throw new AppError(404, 'User not found');
    if (!user.erasureRequestedAt) throw new AppError(400, 'No erasure request on file');

    const anonEmail = `erased-${user.id.slice(0, 8)}@redacted.local`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        firstName: 'REDACTED',
        lastName: 'REDACTED',
        isActive: false,
        erasureCompletedAt: new Date(),
        passwordHash: await (await import('bcryptjs')).hash(cryptoRandom(), 12),
      },
    });

    if (user.provider) {
      await prisma.providerProfile.updateMany({
        where: { providerId: user.provider.id },
        data: { phone: null, address: null, dateOfBirth: null, city: null, state: null, zipCode: null, bio: null },
      });
      // Document files retained under legal hold policy — mark names only
      for (const doc of user.provider.documents) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { name: `REDACTED-${doc.type}` },
        });
      }
    }

    await createAuditLog(
      { action: 'DELETE', entityType: 'User', entityId: userId, metadata: { action: 'erasure_completed' } },
      req
    );

    success(res, { completed: true, userId });
  })
);

function cryptoRandom() {
  return `erased-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default router;
