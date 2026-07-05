import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { committeeService } from '../services/committee.service';
import { meetingMinutesService } from '../services/meeting-minutes.service';
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
  '/reviews/by-application/:applicationId',
  requirePermission('committee.review'),
  asyncHandler(async (req, res) => {
    const review = await committeeService.getReviewByApplication(paramId(req.params.applicationId));
    success(res, review);
  })
);

router.get(
  '/reviews/:id/packet.pdf',
  requirePermission('committee.review'),
  asyncHandler(async (req, res) => {
    const reviewId = paramId(req.params.id);
    const packet = await committeeService.getReviewPacket(reviewId);
    const { generateReviewPacketPdf } = await import('../services/pdf-document.service');
    const pdf = await generateReviewPacketPdf(packet as Record<string, unknown>);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="review-packet-${reviewId.slice(0, 8)}.pdf"`);
    res.send(pdf);
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
  '/meetings/:id/minutes.pdf',
  requirePermission('committee.meeting.read'),
  asyncHandler(async (req, res) => {
    const meetingId = paramId(req.params.id);
    const meeting = await prisma.committeeMeeting.findUnique({
      where: { id: meetingId },
      include: { committee: true },
    });
    if (!meeting?.minutes) {
      res.status(404).json({ success: false, error: 'Meeting minutes not found' });
      return;
    }
    const { generateMeetingMinutesPdf } = await import('../services/pdf-document.service');
    const pdf = await generateMeetingMinutesPdf({
      committeeName: meeting.committee.name,
      meetingTitle: meeting.title,
      minutes: meeting.minutes,
      sentAt: meeting.minutesSentAt || undefined,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="mom-${meetingId.slice(0, 8)}.pdf"`);
    res.send(pdf);
  })
);

router.get(
  '/meetings/:id',
  requirePermission('committee.meeting.read'),
  asyncHandler(async (req, res) => {
    const meeting = await meetingMinutesService.getMeetingForMom(paramId(req.params.id));
    success(res, meeting);
  })
);

router.post(
  '/meetings/:id/conclude-minutes',
  requirePermission('committee.decide'),
  asyncHandler(async (req, res) => {
    const result = await meetingMinutesService.concludeAndSendMinutes(
      paramId(req.params.id),
      {
        minutes: req.body.minutes,
        presentMemberIds: req.body.presentMemberIds || [],
        additionalEmails: req.body.additionalEmails || [],
      },
      req
    );
    success(res, result, 'Minutes prepared and sent');
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
