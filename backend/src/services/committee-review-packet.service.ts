import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { documentComplianceService, isDocumentGateEnforced } from './document-compliance.service';
import { BackgroundVerificationStatus } from '@credpriv/shared';

export class CommitteeReviewPacketService {
  async build(reviewId: string) {
    const review = await prisma.committeeReview.findUnique({
      where: { id: reviewId },
      include: {
        meeting: { include: { committee: true } },
        application: {
          include: {
            staffCategory: true,
            staffSubtype: true,
            jobDescription: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
            privilegeRequests: { include: { jobDescriptionItem: true } },
            backgroundVerifications: {
              include: {
                performedBy: { select: { firstName: true, lastName: true, email: true } },
                thirdPartyVerifier: true,
              },
              orderBy: { initiatedAt: 'desc' },
            },
            provider: {
              include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                profile: {
                  include: {
                    department: true,
                    specialty: true,
                    staffCategory: true,
                    staffSubtype: true,
                  },
                },
                credentials: {
                  include: {
                    verificationRequests: {
                      include: { verifiedBy: { select: { firstName: true, lastName: true } } },
                      orderBy: { requestedAt: 'desc' },
                    },
                  },
                  orderBy: { expiryDate: 'asc' },
                },
                documents: { orderBy: { uploadedAt: 'desc' } },
                privileges: {
                  where: { status: 'APPROVED' },
                  include: { procedure: true, category: true },
                  take: 20,
                },
                applications: {
                  where: { status: { in: ['APPROVED', 'DENIED'] } },
                  orderBy: { updatedAt: 'desc' },
                  take: 5,
                  select: { id: true, type: true, status: true, workflowPhase: true, updatedAt: true },
                },
              },
            },
          },
        },
        decisions: {
          include: { decidedBy: { select: { firstName: true, lastName: true } } },
          orderBy: { decidedAt: 'desc' },
        },
      },
    });

    if (!review) throw new AppError(404, 'Review not found');

    const app = review.application;
    const provider = app.provider;
    const documentCompliance = await documentComplianceService.getCompliance(app.id);

    const privilegeMatrix = (app.jobDescription?.items || []).map((item) => {
      const pr = app.privilegeRequests.find((r) => r.jobDescriptionItemId === item.id);
      return {
        itemId: item.id,
        name: item.name,
        code: item.code,
        suggestedLevel: item.defaultLevel,
        requestedLevel: pr?.requestedLevel || null,
        grantedLevel: pr?.grantedLevel || null,
        status: pr?.status || 'NOT_REQUESTED',
      };
    });

    const credentials = provider.credentials.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      issuingBody: c.issuingBody,
      identifier: c.identifier,
      status: c.status,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
      verifiedAt: c.verifiedAt,
      psv: c.verificationRequests.map((vr) => ({
        id: vr.id,
        status: vr.status,
        source: vr.source,
        sourceMethod: vr.sourceMethod,
        completedAt: vr.completedAt,
        verifiedBy: vr.verifiedBy
          ? `${vr.verifiedBy.firstName} ${vr.verifiedBy.lastName}`
          : null,
        remarks: vr.remarks,
      })),
    }));

    const backgroundVerifications = app.backgroundVerifications.map((bv) => ({
      id: bv.id,
      verificationType: bv.verificationType,
      verifierType: bv.verifierType,
      status: bv.status,
      initiatedAt: bv.initiatedAt,
      completedAt: bv.completedAt,
      findings: bv.findings,
      remarks: bv.remarks,
      performedBy: bv.performedBy
        ? `${bv.performedBy.firstName} ${bv.performedBy.lastName}`
        : null,
      thirdParty: bv.thirdPartyVerifier
        ? {
            id: bv.thirdPartyVerifier.id,
            name: bv.thirdPartyVerifier.name,
            address: [bv.thirdPartyVerifier.address, bv.thirdPartyVerifier.city, bv.thirdPartyVerifier.state]
              .filter(Boolean)
              .join(', '),
            mouReference: bv.thirdPartyVerifier.mouReference,
            mouValidFrom: bv.thirdPartyVerifier.mouValidFrom,
            mouValidTo: bv.thirdPartyVerifier.mouValidTo,
          }
        : bv.thirdPartyName
          ? {
              name: bv.thirdPartyName,
              address: bv.thirdPartyAddress,
              mouReference: bv.mouReference,
            }
          : null,
    }));

    const flags: Array<{ severity: string; code: string; message: string }> = [];

    if (isDocumentGateEnforced() && !documentCompliance.complete) {
      flags.push({
        severity: 'HIGH',
        code: 'DOCS_INCOMPLETE',
        message: `${documentCompliance.missing.length} required document(s) still missing`,
      });
    } else if (!isDocumentGateEnforced()) {
      const pending = documentCompliance.items.filter((i) => !i.uploaded);
      if (pending.length > 0) {
        flags.push({
          severity: 'INFO',
          code: 'DOCS_PENDING',
          message: `${pending.length} suggested document(s) not yet uploaded`,
        });
      }
    }

    const expiringSoon = credentials.filter((c) => {
      if (!c.expiryDate) return false;
      const days = (new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 90;
    });
    for (const c of expiringSoon) {
      flags.push({
        severity: 'MEDIUM',
        code: 'CREDENTIAL_EXPIRING',
        message: `${c.title} expires ${new Date(c.expiryDate!).toLocaleDateString()}`,
      });
    }

    const pendingBg = backgroundVerifications.filter((b) =>
      [BackgroundVerificationStatus.PENDING, BackgroundVerificationStatus.IN_PROGRESS].includes(b.status as BackgroundVerificationStatus)
    );
    if (pendingBg.length > 0) {
      flags.push({
        severity: 'HIGH',
        code: 'BG_CHECK_PENDING',
        message: `${pendingBg.length} background verification(s) not yet complete`,
      });
    }

    const adverseBg = backgroundVerifications.filter((b) => b.status === BackgroundVerificationStatus.ADVERSE);
    for (const b of adverseBg) {
      flags.push({
        severity: 'HIGH',
        code: 'BG_CHECK_ADVERSE',
        message: `Adverse background finding: ${b.verificationType.replace(/_/g, ' ')}`,
      });
    }

    const pendingPsv = credentials.flatMap((c) => c.psv).filter((p) => p.status === 'PENDING' || p.status === 'IN_PROGRESS');
    if (pendingPsv.length > 0) {
      flags.push({
        severity: 'MEDIUM',
        code: 'PSV_PENDING',
        message: `${pendingPsv.length} primary source verification(s) pending`,
      });
    }

    return {
      review: {
        id: review.id,
        status: review.status,
        discussionNotes: review.discussionNotes,
        meeting: review.meeting
          ? {
              id: review.meeting.id,
              title: review.meeting.title,
              scheduledAt: review.meeting.scheduledAt,
              committee: review.meeting.committee.name,
            }
          : null,
        decisions: review.decisions,
      },
      summary: {
        providerId: provider.id,
        providerName: `${provider.user.firstName} ${provider.user.lastName}`,
        email: provider.user.email,
        npi: provider.npi,
        licenseNo: provider.licenseNo,
        department: provider.profile?.department?.name,
        specialty: provider.profile?.specialty?.name,
        staffCategory: app.staffCategory?.name || provider.profile?.staffCategory?.name,
        staffSubtype: app.staffSubtype?.name || provider.profile?.staffSubtype?.name,
        clinicalUnit: app.clinicalUnit || null,
        applicationId: app.id,
        applicationType: app.type,
        workflowPhase: app.workflowPhase,
        status: app.status,
        submittedAt: app.submittedAt,
        credentialingCompleteAt: app.credentialingCompleteAt,
        documentsCompleteAt: app.documentsCompleteAt,
        privilegeRequestedAt: app.privilegeRequestedAt,
      },
      documentCompliance,
      documents: provider.documents.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        uploadedAt: d.uploadedAt,
        mimeType: d.mimeType,
      })),
      credentials,
      backgroundVerifications,
      privilegeMatrix: {
        jobDescriptionTitle: app.jobDescription?.title,
        items: privilegeMatrix,
      },
      jobDescription: app.jobDescription
        ? {
            id: app.jobDescription.id,
            title: app.jobDescription.title,
            clinicalUnit: app.clinicalUnit || app.jobDescription.clinicalUnit,
            description: app.jobDescription.description,
            sourceFileName: app.jobDescription.sourceFileName,
            itemCount: app.jobDescription.items.length,
            items: app.jobDescription.items.map((item) => ({
              id: item.id,
              name: item.name,
              code: item.code,
              description: item.description,
              defaultLevel: item.defaultLevel,
            })),
          }
        : null,
      documentChecklist: documentCompliance.items,
      existingPrivileges: provider.privileges.map((p) => ({
        procedure: p.procedure?.name || p.name,
        category: p.category?.name,
        status: p.status,
        grantedAt: p.grantedAt,
      })),
      priorApplications: provider.applications,
      flags,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const committeeReviewPacketService = new CommitteeReviewPacketService();
