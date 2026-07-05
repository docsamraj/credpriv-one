import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';
import { BackgroundVerificationStatus, VerifierType } from '@credpriv/shared';

export class BackgroundVerificationService {
  async listThirdPartyVerifiers() {
    return prisma.thirdPartyVerifier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createThirdPartyVerifier(data: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    mouReference?: string;
    mouValidFrom?: Date;
    mouValidTo?: Date;
    mouDocumentPath?: string;
    servicesOffered?: string;
    notes?: string;
  }, req?: Request) {
    const record = await prisma.thirdPartyVerifier.create({ data });
    await createAuditLog(
      { action: 'CREATE', entityType: 'ThirdPartyVerifier', entityId: record.id, newValue: record },
      req
    );
    return record;
  }

  async listByApplication(applicationId: string) {
    return prisma.backgroundVerification.findMany({
      where: { applicationId },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        thirdPartyVerifier: true,
      },
      orderBy: { initiatedAt: 'desc' },
    });
  }

  async create(applicationId: string, data: {
    verificationType?: string;
    verifierType: string;
    thirdPartyVerifierId?: string;
    thirdPartyName?: string;
    thirdPartyAddress?: string;
    mouReference?: string;
    mouDocumentPath?: string;
    remarks?: string;
  }, performedByUserId?: string, req?: Request) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new AppError(404, 'Application not found');

    if (data.verifierType === VerifierType.HOSPITAL) {
      if (!performedByUserId) throw new AppError(400, 'Hospital verification requires staff user');
    } else if (data.verifierType === VerifierType.THIRD_PARTY) {
      if (!data.thirdPartyVerifierId && !data.thirdPartyName?.trim()) {
        throw new AppError(400, 'Third-party verification requires agency from registry or name/address');
      }
    } else {
      throw new AppError(400, 'Invalid verifier type');
    }

    let thirdPartySnapshot: {
      thirdPartyName?: string;
      thirdPartyAddress?: string;
      mouReference?: string;
      mouDocumentPath?: string;
    } = {};

    if (data.thirdPartyVerifierId) {
      const agency = await prisma.thirdPartyVerifier.findUnique({ where: { id: data.thirdPartyVerifierId } });
      if (!agency) throw new AppError(404, 'Third-party verifier not found');
      thirdPartySnapshot = {
        thirdPartyName: agency.name,
        thirdPartyAddress: [agency.address, agency.city, agency.state, agency.pinCode].filter(Boolean).join(', '),
        mouReference: data.mouReference || agency.mouReference || undefined,
        mouDocumentPath: data.mouDocumentPath || agency.mouDocumentPath || undefined,
      };
    } else if (data.verifierType === VerifierType.THIRD_PARTY) {
      thirdPartySnapshot = {
        thirdPartyName: data.thirdPartyName?.trim(),
        thirdPartyAddress: data.thirdPartyAddress?.trim(),
        mouReference: data.mouReference?.trim(),
        mouDocumentPath: data.mouDocumentPath,
      };
    }

    const record = await prisma.backgroundVerification.create({
      data: {
        applicationId,
        verificationType: data.verificationType || 'BACKGROUND_CHECK',
        verifierType: data.verifierType,
        performedByUserId: data.verifierType === VerifierType.HOSPITAL ? performedByUserId : null,
        thirdPartyVerifierId: data.thirdPartyVerifierId || null,
        ...thirdPartySnapshot,
        remarks: data.remarks,
        status: BackgroundVerificationStatus.PENDING,
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        thirdPartyVerifier: true,
      },
    });

    await createAuditLog(
      { action: 'CREATE', entityType: 'BackgroundVerification', entityId: record.id, newValue: record },
      req
    );
    return record;
  }

  async update(id: string, data: {
    status?: string;
    findings?: string;
    remarks?: string;
    completedAt?: Date;
  }, req?: Request) {
    const existing = await prisma.backgroundVerification.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Background verification not found');

    const terminal = [
      BackgroundVerificationStatus.CLEAR,
      BackgroundVerificationStatus.ADVERSE,
      BackgroundVerificationStatus.INCONCLUSIVE,
    ];
    const completedAt =
      data.completedAt ||
      (data.status && terminal.includes(data.status as BackgroundVerificationStatus) ? new Date() : undefined);

    const record = await prisma.backgroundVerification.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.findings !== undefined && { findings: data.findings }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(completedAt && { completedAt }),
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        thirdPartyVerifier: true,
      },
    });

    await createAuditLog(
      { action: 'UPDATE', entityType: 'BackgroundVerification', entityId: id, newValue: record },
      req
    );
    return record;
  }
}

export const backgroundVerificationService = new BackgroundVerificationService();
