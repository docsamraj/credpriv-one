import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';
import { committeeReviewPacketService } from './committee-review-packet.service';
import { notificationService } from './notification.service';
import { dispatchWebhookEvent } from './webhook-dispatch.service';
import { IntegrationWebhookEvent } from '@credpriv/shared';

export class CommitteeService {
  async listCommittees() {
    return prisma.committee.findMany({
      where: { isActive: true },
      include: { members: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    });
  }

  async getUpcomingMeetings(committeeId?: string) {
    const since = new Date();
    since.setDate(since.getDate() - 14);

    return prisma.committeeMeeting.findMany({
      where: {
        scheduledAt: { gte: since },
        status: { not: 'CANCELLED' },
        ...(committeeId && { committeeId }),
      },
      include: {
        committee: true,
        reviews: {
          include: {
            application: {
              include: {
                provider: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                    profile: { include: { specialty: true, department: true } },
                  },
                },
              },
            },
            decisions: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createReview(applicationId: string, meetingId?: string) {
    return prisma.committeeReview.create({
      data: { applicationId, meetingId, status: 'PENDING' },
    });
  }

  async getReviewByApplication(applicationId: string) {
    const review = await prisma.committeeReview.findFirst({
      where: { applicationId, status: { in: ['PENDING', 'IN_REVIEW'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        meeting: { select: { id: true, title: true, scheduledAt: true } },
      },
    });
    if (!review) throw new AppError(404, 'No active committee review for this application');
    return review;
  }

  async getReviewPacket(reviewId: string) {
    return committeeReviewPacketService.build(reviewId);
  }

  async recordDecision(
    reviewId: string,
    decidedById: string,
    decisionType: string,
    rationale?: string,
    req?: Request
  ) {
    const decision = await prisma.committeeDecision.create({
      data: { reviewId, decidedById, decisionType, rationale },
    });

    const review = await prisma.committeeReview.findUnique({
      where: { id: reviewId },
      include: { application: true },
    });

    if (review) {
      let newStatus = review.application.status;
      if (decisionType === 'APPROVE') newStatus = 'APPROVED';
      else if (decisionType === 'DENY') newStatus = 'DENIED';
      else if (decisionType === 'RETURN_FOR_INFO') newStatus = 'NEEDS_INFO';
      else if (decisionType === 'DEFER') newStatus = 'COMMITTEE';

      await prisma.application.update({
        where: { id: review.applicationId },
        data: { status: newStatus },
      });

      await prisma.committeeReview.update({
        where: { id: reviewId },
        data: { status: 'COMPLETED' },
      });

      const statusMessages: Record<string, string> = {
        APPROVED: 'Your application has been approved by the committee.',
        DENIED: 'Your application was denied by the committee. Contact credentialing staff for details.',
        NEEDS_INFO: 'The committee has returned your application for additional information.',
        COMMITTEE: 'Your application has been deferred to a future committee meeting.',
      };
      await notificationService.notifyApplicationStatusChange(
        review.applicationId,
        newStatus,
        statusMessages[newStatus] || `Application status updated to ${newStatus}.`
      );

      const webhookEvent =
        decisionType === 'APPROVE'
          ? IntegrationWebhookEvent.APPLICATION_APPROVED
          : IntegrationWebhookEvent.COMMITTEE_DECISION_RECORDED;
      await dispatchWebhookEvent(webhookEvent, {
        reviewId,
        applicationId: review.applicationId,
        decisionType,
        newStatus,
      });
    }

    await createAuditLog(
      { action: 'DECIDE', entityType: 'CommitteeDecision', entityId: decision.id, newValue: decision },
      req
    );

    return decision;
  }
}

export const committeeService = new CommitteeService();
