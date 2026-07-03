import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';

export class ApplicationService {
  async list(filters?: { status?: string; providerId?: string; committeeReady?: boolean }) {
    return prisma.application.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.providerId && { providerId: filters.providerId }),
        ...(filters?.committeeReady !== undefined && { committeeReady: filters.committeeReady }),
      },
      include: {
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            profile: { include: { department: true, specialty: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(providerId: string, type: string) {
    return prisma.application.create({
      data: { providerId, type, status: 'DRAFT' },
    });
  }

  async submit(id: string, req?: Request) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.status !== 'DRAFT' && app.status !== 'NEEDS_INFO') {
      throw new AppError(400, 'Application cannot be submitted in current status');
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), currentStage: 'SUBMITTED' },
    });

    await createAuditLog(
      { action: 'SUBMIT', entityType: 'Application', entityId: id, newValue: updated },
      req
    );

    return updated;
  }

  async markCommitteeReady(id: string, req?: Request) {
    const updated = await prisma.application.update({
      where: { id },
      data: {
        committeeReady: true,
        committeeReadyAt: new Date(),
        status: 'COMMITTEE',
        currentStage: 'COMMITTEE',
      },
    });

    await createAuditLog(
      { action: 'UPDATE', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'committee_ready' } },
      req
    );

    return updated;
  }

  async getStaffQueues() {
    const [newApps, pendingDocs, pendingPsv, committeeReady] = await Promise.all([
      prisma.application.count({ where: { status: 'SUBMITTED' } }),
      prisma.document.count({
        where: { credential: { status: 'PENDING' } },
      }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { committeeReady: true, status: 'COMMITTEE' } }),
    ]);

    return {
      newApplications: newApps,
      pendingDocuments: pendingDocs,
      pendingPsv,
      committeeReady,
    };
  }
}

export const applicationService = new ApplicationService();
