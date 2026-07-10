import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';
import { getCloudflareAiStatus } from '../modules/ai/ai-config';
import { runCredentialExpiryReminders } from '../jobs/credential-expiry.job';
import { committeeMemberService } from '../services/committee-member.service';

const router = Router();

router.use(authenticate);
router.use(requirePermission('application.read'));

// Admin config routes — SYSTEM_ADMIN or credentialing staff for read
router.get(
  '/departments',
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({ where: { isActive: true } });
    success(res, departments);
  })
);

router.post(
  '/departments',
  requirePermission('application.read'), // TODO: admin.config permission
  asyncHandler(async (req, res) => {
    const dept = await prisma.department.create({ data: req.body });
    success(res, dept, 'Department created', 201);
  })
);

router.get(
  '/specialties',
  asyncHandler(async (req, res) => {
    const specialties = await prisma.specialty.findMany({
      where: {
        isActive: true,
        ...(req.query.departmentId && { departmentId: req.query.departmentId as string }),
      },
    });
    success(res, specialties);
  })
);

router.get(
  '/required-documents',
  asyncHandler(async (req, res) => {
    const docs = await prisma.requiredDocument.findMany({
      where: req.query.specialtyId ? { specialtyId: req.query.specialtyId as string } : {},
      orderBy: { sortOrder: 'asc' },
    });
    success(res, docs);
  })
);

router.get(
  '/workflow-stages',
  asyncHandler(async (_req, res) => {
    const stages = await prisma.workflowStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    success(res, stages);
  })
);

router.get(
  '/notification-rules',
  asyncHandler(async (_req, res) => {
    const rules = await prisma.notificationRule.findMany({ where: { isActive: true } });
    success(res, rules);
  })
);

router.get(
  '/webhooks',
  requirePermission('integration.read'),
  asyncHandler(async (_req, res) => {
    const subs = await prisma.webhookSubscription.findMany({
      include: { system: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    success(
      res,
      subs.map((s) => ({ ...s, secretHash: s.secretHash ? '[configured]' : null }))
    );
  })
);

router.post(
  '/webhooks',
  requirePermission('integration.admin'),
  asyncHandler(async (req, res) => {
    const system = await prisma.integrationSystem.findUnique({ where: { code: req.body.systemCode } });
    if (!system) return res.status(404).json({ success: false, error: 'Integration system not found' });

    const sub = await prisma.webhookSubscription.create({
      data: {
        systemId: system.id,
        event: req.body.event,
        targetUrl: req.body.targetUrl,
        secretHash: req.body.secret
          ? (await import('../utils/file-crypto')).encryptSecret(String(req.body.secret))
          : null,
        isActive: req.body.isActive !== false,
      },
    });
    success(res, { ...sub, secretHash: sub.secretHash ? '[redacted]' : null }, 'Webhook subscription created', 201);
  })
);

router.get(
  '/integration-systems',
  requirePermission('integration.read'),
  asyncHandler(async (_req, res) => {
    const systems = await prisma.integrationSystem.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    success(res, systems);
  })
);

router.get(
  '/ai-status',
  requirePermission('job_description.manage'),
  asyncHandler(async (_req, res) => {
    success(res, getCloudflareAiStatus());
  })
);

router.post(
  '/jobs/credential-expiry-reminders',
  requirePermission('audit.read'),
  asyncHandler(async (_req, res) => {
    const result = await runCredentialExpiryReminders();
    success(res, result, 'Credential expiry reminder job completed');
  })
);

router.get(
  '/audit-logs',
  requirePermission('audit.read'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);

    success(res, { items, total, page, pageSize });
  })
);

router.get(
  '/committees',
  requirePermission('committee.manage'),
  asyncHandler(async (_req, res) => {
    const committees = await committeeMemberService.listCommitteesWithRoster();
    success(res, committees);
  })
);

router.get(
  '/users/search',
  requirePermission('committee.manage'),
  asyncHandler(async (req, res) => {
    const users = await committeeMemberService.searchUsers(req.query.q as string | undefined);
    success(res, users);
  })
);

router.post(
  '/committees/:committeeId/members',
  requirePermission('committee.manage'),
  asyncHandler(async (req, res) => {
    const member = await committeeMemberService.addMember(
      paramId(req.params.committeeId),
      req.body,
      req
    );
    success(res, member, 'Committee member added', 201);
  })
);

router.put(
  '/committees/:committeeId/members/:memberId',
  requirePermission('committee.manage'),
  asyncHandler(async (req, res) => {
    const member = await committeeMemberService.updateMember(
      paramId(req.params.committeeId),
      paramId(req.params.memberId),
      req.body,
      req
    );
    success(res, member, 'Committee member updated');
  })
);

router.delete(
  '/committees/:committeeId/members/:memberId',
  requirePermission('committee.manage'),
  asyncHandler(async (req, res) => {
    await committeeMemberService.removeMember(
      paramId(req.params.committeeId),
      paramId(req.params.memberId),
      req
    );
    success(res, null, 'Committee member removed');
  })
);

export default router;
