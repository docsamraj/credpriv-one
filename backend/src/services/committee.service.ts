import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';

export class CommitteeService {
  async listCommittees() {
    return prisma.committee.findMany({
      where: { isActive: true },
      include: { members: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    });
  }

  async getUpcomingMeetings(committeeId?: string) {
    return prisma.committeeMeeting.findMany({
      where: {
        scheduledAt: { gte: new Date() },
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

  async getReviewPacket(reviewId: string) {
    const review = await prisma.committeeReview.findUnique({
      where: { id: reviewId },
      include: {
        application: {
          include: {
            provider: {
              include: {
                user: true,
                profile: { include: { department: true, specialty: true } },
                credentials: { include: { verificationRequests: true } },
                privileges: { include: { procedure: true, category: true } },
                documents: true,
              },
            },
          },
        },
        decisions: { include: { decidedBy: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!review) throw new AppError(404, 'Review not found');
    return review;
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
    }

    await createAuditLog(
      { action: 'DECIDE', entityType: 'CommitteeDecision', entityId: decision.id, newValue: decision },
      req
    );

    return decision;
  }
}

export const committeeService = new CommitteeService();
