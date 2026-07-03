import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { committeeService } from '../services/committee.service';
import { caseSummaryService } from '../modules/ai';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('committee.read'),
  asyncHandler(async (_req, res) => {
    const committees = await committeeService.listCommittees();
    success(res, committees);
  })
);

router.get(
  '/meetings',
  requirePermission('committee.meeting.read'),
  asyncHandler(async (req, res) => {
    const meetings = await committeeService.getUpcomingMeetings(req.query.committeeId as string);
    success(res, meetings);
  })
);

router.get(
  '/reviews/:id',
  requirePermission('committee.review'),
  asyncHandler(async (req, res) => {
    const packet = await committeeService.getReviewPacket(paramId(req.params.id));
    success(res, packet);
  })
);

router.post(
  '/reviews',
  requirePermission('committee.review'),
  asyncHandler(async (req, res) => {
    const review = await committeeService.createReview(req.body.applicationId, req.body.meetingId);
    success(res, review, 'Review created', 201);
  })
);

router.post(
  '/reviews/:id/decisions',
  requirePermission('committee.decide'),
  asyncHandler(async (req, res) => {
    const decision = await committeeService.recordDecision(
      paramId(req.params.id),
      req.user!.userId,
      req.body.decisionType,
      req.body.rationale,
      req
    );
    success(res, decision, 'Decision recorded');
  })
);

router.get(
  '/ai-summary/:providerId',
  requirePermission('committee.review'),
  asyncHandler(async (req, res) => {
    const summary = await caseSummaryService.generateSummary(paramId(req.params.providerId));
    success(res, summary);
  })
);

// Privilege matrix
router.get(
  '/privileges/matrix',
  requirePermission('privilege.read'),
  asyncHandler(async (req, res) => {
    const matrix = await prisma.procedure.findMany({
      where: {
        isActive: true,
        ...(req.query.departmentId && { departmentId: req.query.departmentId as string }),
      },
      include: { department: true, category: true },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });
    success(res, matrix);
  })
);

router.get(
  '/privileges/provider/:providerId',
  requirePermission('privilege.read'),
  asyncHandler(async (req, res) => {
    const privileges = await prisma.privilege.findMany({
      where: { providerId: paramId(req.params.providerId) },
      include: { procedure: true, category: true },
    });
    success(res, privileges);
  })
);

router.post(
  '/privileges',
  requirePermission('privilege.request'),
  asyncHandler(async (req, res) => {
    const privilege = await prisma.privilege.create({ data: req.body });
    success(res, privilege, 'Privilege requested', 201);
  })
);

export default router;
