import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';
import { WorkflowPhase } from '@credpriv/shared';
import { documentComplianceService } from './document-compliance.service';
import { notificationService } from './notification.service';
import { committeeService } from './committee.service';
import { dispatchWebhookEvent } from './webhook-dispatch.service';
import { IntegrationWebhookEvent } from '@credpriv/shared';

async function categoryRequiresCommittee(staffCategoryId?: string | null): Promise<boolean> {
  if (!staffCategoryId) return true;
  const cat = await prisma.staffCategory.findUnique({
    where: { id: staffCategoryId },
    select: { requiresCommitteeReview: true },
  });
  return cat?.requiresCommitteeReview ?? true;
}

export class ApplicationService {
  async list(filters?: { status?: string; providerId?: string; committeeReady?: boolean; workflowPhase?: string; departmentIds?: string[] }) {
    return prisma.application.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.providerId && { providerId: filters.providerId }),
        ...(filters?.committeeReady !== undefined && { committeeReady: filters.committeeReady }),
        ...(filters?.workflowPhase && { workflowPhase: filters.workflowPhase }),
        ...(filters?.departmentIds?.length && {
          provider: { profile: { departmentId: { in: filters.departmentIds } } },
        }),
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
    opts?: { staffCategoryId?: string; staffSubtypeId?: string; jobDescriptionId?: string; clinicalUnit?: string }
  ) {
    let jobDescriptionId = opts?.jobDescriptionId;
    if (opts?.staffSubtypeId && !jobDescriptionId) {
      const unit = (opts.clinicalUnit || '').trim();
      const jd = await prisma.jobDescription.findFirst({
        where: { subtypeId: opts.staffSubtypeId, clinicalUnit: unit },
      });
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
        clinicalUnit: (opts?.clinicalUnit || '').trim(),
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
      throw new AppError(400, 'Select your staff role before submitting');
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
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      'Your application has been submitted. Please upload required education and credential documents.'
    );
    return updated;
  }

  async completeCredentialing(id: string, req?: Request) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'Application not found');

    if (!['DOCUMENT_UPLOAD', 'CREDENTIALING'].includes(app.workflowPhase || '')) {
      throw new AppError(400, 'Application is not in document upload or credentialing phase');
    }

    await documentComplianceService.assertComplete(id);

    const requiresCommittee = await categoryRequiresCommittee(app.staffCategoryId);
    const nextPhase = requiresCommittee
      ? WorkflowPhase.PRIVILEGE_REQUEST
      : WorkflowPhase.DEPARTMENT_APPROVAL;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'UNDER_VERIFICATION',
        workflowPhase: nextPhase,
        credentialingCompleteAt: new Date(),
        documentsCompleteAt: new Date(),
        currentStage: nextPhase,
      },
    });

    await createAuditLog(
      { action: 'UPDATE', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'credentialing_complete' } },
      req
    );
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      requiresCommittee
        ? 'Credentialing review is complete. You may now request privileges from your job description.'
        : 'Credentialing review is complete. Your application is pending department head approval.'
    );
    if (!requiresCommittee) {
      await dispatchWebhookEvent(IntegrationWebhookEvent.DEPARTMENT_APPROVAL_REQUESTED, {
        applicationId: id,
        providerId: app.providerId,
      });
    }
    await dispatchWebhookEvent(IntegrationWebhookEvent.CREDENTIALING_COMPLETE, {
      applicationId: id,
      providerId: app.providerId,
      requiresCommitteeReview: requiresCommittee,
    });
    return updated;
  }

  async approveDepartmentClearance(id: string, userId: string, req?: Request) {
    const { app, department: dept } = await this.assertDepartmentChair(userId, id);
    const deptId = dept.id;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        workflowPhase: WorkflowPhase.STAFF_CLEARANCE,
        currentStage: WorkflowPhase.STAFF_CLEARANCE,
      },
    });

    await createAuditLog(
      { action: 'APPROVE', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'department_approved', departmentId: deptId } },
      req
    );
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      `Department approval granted by ${dept.name}. Pending final credentialing staff clearance.`
    );
    await dispatchWebhookEvent(IntegrationWebhookEvent.DEPARTMENT_APPROVAL_GRANTED, {
      applicationId: id,
      providerId: app.providerId,
      departmentId: deptId,
    });
    return this.getById(id);
  }

  private async assertDepartmentChair(userId: string, applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { provider: { include: { profile: true } } },
    });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.workflowPhase !== WorkflowPhase.DEPARTMENT_APPROVAL) {
      throw new AppError(400, 'Application is not awaiting department approval');
    }
    if (await categoryRequiresCommittee(app.staffCategoryId)) {
      throw new AppError(400, 'Clinical applications use committee review, not department clearance');
    }

    const deptId = app.provider.profile?.departmentId;
    if (!deptId) throw new AppError(400, 'Applicant has no department assigned');

    const dept = await prisma.department.findFirst({
      where: { id: deptId, chairUserId: userId, isActive: true },
    });
    if (!dept) throw new AppError(403, 'You are not the department head for this applicant');

    return { app, department: dept };
  }

  async returnDepartmentForInfo(id: string, userId: string, comments: string, req?: Request) {
    const { app, department } = await this.assertDepartmentChair(userId, id);

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'NEEDS_INFO',
        workflowPhase: WorkflowPhase.DOCUMENT_UPLOAD,
        currentStage: WorkflowPhase.DOCUMENT_UPLOAD,
      },
    });

    await createAuditLog(
      {
        action: 'UPDATE',
        entityType: 'Application',
        entityId: id,
        newValue: updated,
        metadata: { action: 'department_returned_for_info', departmentId: department.id, comments },
      },
      req
    );
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      `Department head (${department.name}) returned your application for more information: ${comments}`
    );
    return this.getById(id);
  }

  async rejectDepartmentApplication(id: string, userId: string, rationale: string, req?: Request) {
    const { app, department } = await this.assertDepartmentChair(userId, id);

    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: 'DENIED',
        workflowPhase: WorkflowPhase.COMPLETE,
        currentStage: WorkflowPhase.COMPLETE,
      },
    });

    await createAuditLog(
      {
        action: 'DENY',
        entityType: 'Application',
        entityId: id,
        newValue: updated,
        metadata: { action: 'department_rejected', departmentId: department.id, rationale },
      },
      req
    );
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      `Department head (${department.name}) did not approve your application: ${rationale}`
    );
    await dispatchWebhookEvent(IntegrationWebhookEvent.COMMITTEE_DECISION_RECORDED, {
      applicationId: id,
      providerId: app.providerId,
      decisionType: 'DENY',
      pathway: 'DEPARTMENT',
    });
    return this.getById(id);
  }

  async approveStaffClearance(id: string, req?: Request) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'Application not found');
    if (app.workflowPhase !== WorkflowPhase.STAFF_CLEARANCE) {
      throw new AppError(400, 'Application is not awaiting staff clearance');
    }
    if (await categoryRequiresCommittee(app.staffCategoryId)) {
      throw new AppError(400, 'Clinical applications require committee review, not staff clearance');
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
      { action: 'APPROVE', entityType: 'Application', entityId: id, newValue: updated, metadata: { action: 'staff_clearance_approved' } },
      req
    );
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      'Your onboarding has been approved. Welcome to the hospital.'
    );
    await dispatchWebhookEvent(IntegrationWebhookEvent.APPLICATION_APPROVED, {
      applicationId: id,
      providerId: app.providerId,
      status: updated.status,
      pathway: 'STAFF_CLEARANCE',
    });
    return this.getById(id);
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
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      'Your privilege requests have been submitted and are queued for committee review.'
    );

    const existingReview = await prisma.committeeReview.findFirst({
      where: { applicationId: id, status: { in: ['PENDING', 'IN_REVIEW'] } },
    });
    if (!existingReview) {
      const nextMeeting = await prisma.committeeMeeting.findFirst({
        where: {
          scheduledAt: { gte: new Date() },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          committee: { type: 'CREDENTIALING', isActive: true },
        },
        orderBy: { scheduledAt: 'asc' },
      });
      await committeeService.createReview(id, nextMeeting?.id);
    }

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
    await notificationService.notifyApplicationStatusChange(
      id,
      updated.status,
      'Your clinical privileges have been granted by the committee. Your credentialing cycle is complete.'
    );
    await dispatchWebhookEvent(IntegrationWebhookEvent.PRIVILEGE_GRANTED, {
      applicationId: id,
      providerId: app.providerId,
      status: updated.status,
    });
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
    const [newApps, pendingDocs, pendingPsv, committeeReady, privilegePending, staffClearancePending, departmentApprovalPending] = await Promise.all([
      prisma.application.count({ where: { status: 'SUBMITTED', workflowPhase: WorkflowPhase.DOCUMENT_UPLOAD } }),
      prisma.document.count({ where: { credential: { status: 'PENDING' } } }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { committeeReady: true, workflowPhase: WorkflowPhase.COMMITTEE_REVIEW } }),
      prisma.application.count({ where: { workflowPhase: WorkflowPhase.PRIVILEGE_REQUEST } }),
      prisma.application.count({ where: { workflowPhase: WorkflowPhase.STAFF_CLEARANCE } }),
      prisma.application.count({ where: { workflowPhase: WorkflowPhase.DEPARTMENT_APPROVAL } }),
    ]);

    return {
      newApplications: newApps,
      pendingDocuments: pendingDocs,
      pendingPsv,
      committeeReady,
      privilegePending,
      staffClearancePending,
      departmentApprovalPending,
    };
  }
}

export const applicationService = new ApplicationService();
