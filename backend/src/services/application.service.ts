import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';
import { WorkflowPhase } from '@credpriv/shared';

export class ApplicationService {
  async list(filters?: { status?: string; providerId?: string; committeeReady?: boolean; workflowPhase?: string }) {
    return prisma.application.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.providerId && { providerId: filters.providerId }),
        ...(filters?.committeeReady !== undefined && { committeeReady: filters.committeeReady }),
        ...(filters?.workflowPhase && { workflowPhase: filters.workflowPhase }),
      },
      include: {
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            profile: {
              include: {
                department: true,
                specialty: true,
                staffCategory: true,
                staffSubtype: true,
              },
            },
          },
        },
        staffCategory: true,
        staffSubtype: true,
        jobDescription: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
        privilegeRequests: {
          include: { jobDescriptionItem: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getById(id: string) {
    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            profile: { include: { staffCategory: true, staffSubtype: true } },
            documents: true,
          },
        },
        staffCategory: true,
        staffSubtype: true,
        jobDescription: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
        privilegeRequests: { include: { jobDescriptionItem: true } },
      },
    });
    if (!app) throw new AppError(404, 'Application not found');
    return app;
  }

  async create(
    providerId: string,
    type: string,
    opts?: { staffCategoryId?: string; staffSubtypeId?: string; jobDescriptionId?: string }
  ) {
    let jobDescriptionId = opts?.jobDescriptionId;
    if (opts?.staffSubtypeId && !jobDescriptionId) {
      const jd = await prisma.jobDescription.findFirst({ where: { subtypeId: opts.staffSubtypeId } });
      jobDescriptionId = jd?.id;
    }

    const app = await prisma.application.create({
      data: {
        providerId,
        type,
        status: 'DRAFT',
        workflowPhase: WorkflowPhase.APPOINTMENT,
        staffCategoryId: opts?.staffCategoryId,
        staffSubtypeId: opts?.staffSubtypeId,
        jobDescriptionId,
      },
      include: { staffCategory: true, staffSubtype: true, jobDescription: true },
    });

    if (opts?.staffCategoryId || opts?.staffSubtypeId) {
      await prisma.providerProfile.updateMany({
        where: { providerId },
        data: {
          ...(opts.staffCategoryId && { staffCategoryId: opts.staffCategoryId }),
          ...(opts.staffSubtypeId && { staffSubtypeId: opts.staffSubtypeId }),
        },
      });
    }

    return app;
  }

  async submit(id: string, req?: Request) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.status !== 'DRAFT' && app.status !== 'NEEDS_INFO') {
      throw new AppError(400, 'Application cannot be submitted in current status');
    }
    if (!app.staffSubtypeId) {
      throw new AppError(400, 'Select your role (Doctor/Nurse/Technician) before submitting');
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        workflowPhase: WorkflowPhase.DOCUMENT_UPLOAD,
        submittedAt: new Date(),
        currentStage: 'DOCUMENT_UPLOAD',
      },
    });

    await createAuditLog({ action: 'SUBMIT', entityType: 'Application', entityId: id, newValue: updated }, req);
    return updated;
  }

  async completeCredentialing(id: string, req?: Request) {
    const app = await prisma.application.findUnique({
      where: { id },
      include: { provider: { include: { documents: true } } },
    });
    if (!app) throw new AppError(404, 'Application not found');

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'UNDER_VERIFICATION',
        workflowPhase: WorkflowPhase.PRIVILEGE_REQUEST,
        credentialingCompleteAt: new Date(),
        currentStage: 'PRIVILEGE_REQUEST',
      },
    });

    await createAuditLog(
      { action: 'UPDATE', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'credentialing_complete' } },
      req
    );
    return updated;
  }

  async savePrivilegeRequests(
    id: string,
    requests: { jobDescriptionItemId: string; requestedLevel: string }[]
  ) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.workflowPhase !== WorkflowPhase.PRIVILEGE_REQUEST) {
      throw new AppError(400, 'Privilege requests can only be saved during the privilege request phase');
    }

    for (const r of requests) {
      await prisma.applicationPrivilegeRequest.upsert({
        where: {
          applicationId_jobDescriptionItemId: {
            applicationId: id,
            jobDescriptionItemId: r.jobDescriptionItemId,
          },
        },
        update: { requestedLevel: r.requestedLevel },
        create: {
          applicationId: id,
          jobDescriptionItemId: r.jobDescriptionItemId,
          requestedLevel: r.requestedLevel,
        },
      });
    }

    return this.getById(id);
  }

  async submitPrivileges(id: string, req?: Request) {
    const app = await prisma.application.findUnique({
      where: { id },
      include: { privilegeRequests: true, jobDescription: { include: { items: true } } },
    });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.workflowPhase !== WorkflowPhase.PRIVILEGE_REQUEST) {
      throw new AppError(400, 'Not in privilege request phase');
    }
    const requiredCount = app.jobDescription?.items.length ?? 0;
    if (app.privilegeRequests.length < requiredCount) {
      throw new AppError(400, 'Complete privilege requests for all job description items');
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'COMMITTEE',
        workflowPhase: WorkflowPhase.COMMITTEE_REVIEW,
        privilegeRequestedAt: new Date(),
        committeeReady: true,
        committeeReadyAt: new Date(),
        currentStage: 'COMMITTEE_REVIEW',
      },
    });

    await createAuditLog(
      { action: 'SUBMIT', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'privileges_submitted' } },
      req
    );
    return updated;
  }

  async grantPrivileges(
    id: string,
    grants: { jobDescriptionItemId: string; grantedLevel: string }[],
    grantedById: string,
    req?: Request
  ) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.workflowPhase !== WorkflowPhase.COMMITTEE_REVIEW) {
      throw new AppError(400, 'Application is not in committee review');
    }

    for (const g of grants) {
      await prisma.applicationPrivilegeRequest.updateMany({
        where: { applicationId: id, jobDescriptionItemId: g.jobDescriptionItemId },
        data: {
          grantedLevel: g.grantedLevel,
          status: g.grantedLevel === 'NONE' ? 'DENIED' : 'GRANTED',
          grantedAt: new Date(),
          grantedById,
        },
      });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'APPROVED',
        workflowPhase: WorkflowPhase.COMPLETE,
        currentStage: 'COMPLETE',
      },
    });

    await createAuditLog(
      { action: 'APPROVE', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'privileges_granted' } },
      req
    );
    return this.getById(id);
  }

  async markCommitteeReady(id: string, req?: Request) {
    const updated = await prisma.application.update({
      where: { id },
      data: {
        committeeReady: true,
        committeeReadyAt: new Date(),
        status: 'COMMITTEE',
        workflowPhase: WorkflowPhase.COMMITTEE_REVIEW,
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
    const [newApps, pendingDocs, pendingPsv, committeeReady, privilegePending] = await Promise.all([
      prisma.application.count({ where: { status: 'SUBMITTED', workflowPhase: WorkflowPhase.DOCUMENT_UPLOAD } }),
      prisma.document.count({ where: { credential: { status: 'PENDING' } } }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { committeeReady: true, workflowPhase: WorkflowPhase.COMMITTEE_REVIEW } }),
      prisma.application.count({ where: { workflowPhase: WorkflowPhase.PRIVILEGE_REQUEST } }),
    ]);

    return {
      newApplications: newApps,
      pendingDocuments: pendingDocs,
      pendingPsv,
      committeeReady,
      privilegePending,
    };
  }
}

export const applicationService = new ApplicationService();
