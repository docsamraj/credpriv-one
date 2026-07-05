import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { documentComplianceService } from './document-compliance.service';

export class OnboardingPacketService {
  async build(applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        staffCategory: true,
        staffSubtype: true,
        backgroundVerifications: {
          include: { thirdPartyVerifier: true },
          orderBy: { initiatedAt: 'desc' },
          take: 5,
        },
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            profile: { include: { department: true, staffCategory: true, staffSubtype: true } },
            documents: { orderBy: { uploadedAt: 'desc' } },
            credentials: { orderBy: { expiryDate: 'asc' } },
          },
        },
      },
    });
    if (!app) throw new AppError(404, 'Application not found');

    const documentCompliance = await documentComplianceService.getCompliance(applicationId);
    const user = app.provider.user;
    const profile = app.provider.profile;

    return {
      generatedAt: new Date().toISOString(),
      applicationId: app.id,
      applicationType: app.type,
      status: app.status,
      workflowPhase: app.workflowPhase,
      submittedAt: app.submittedAt,
      credentialingCompleteAt: app.credentialingCompleteAt,
      summary: {
        applicantName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        department: profile?.department?.name,
        staffCategory: app.staffCategory?.name || profile?.staffCategory?.name,
        staffSubtype: app.staffSubtype?.name || profile?.staffSubtype?.name,
        employmentType: profile?.employmentType,
        phone: profile?.phone,
      },
      documentCompliance,
      documents: app.provider.documents.map((d) => ({
        name: d.name,
        type: d.type,
        uploadedAt: d.uploadedAt,
      })),
      credentials: app.provider.credentials.map((c) => ({
        title: c.title,
        type: c.type,
        status: c.status,
        expiryDate: c.expiryDate,
      })),
      backgroundVerifications: app.backgroundVerifications.map((b) => ({
        verificationType: b.verificationType,
        status: b.status,
        agency: b.thirdPartyVerifier?.name,
        findings: b.findings,
      })),
    };
  }
}

export const onboardingPacketService = new OnboardingPacketService();
