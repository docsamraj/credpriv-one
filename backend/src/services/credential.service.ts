import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';

export class CredentialService {
  async listByProvider(providerId: string) {
    return prisma.credential.findMany({
      where: { providerId },
      include: { verificationRequests: true, documents: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async create(providerId: string, data: {
    type: string;
    title: string;
    issuingBody?: string;
    identifier?: string;
    issueDate?: Date;
    expiryDate?: Date;
  }, req?: Request) {
    const credential = await prisma.credential.create({
      data: { providerId, ...data },
    });

    await createAuditLog(
      { action: 'CREATE', entityType: 'Credential', entityId: credential.id, newValue: credential },
      req
    );

    return credential;
  }

  async updateStatus(id: string, status: string, req?: Request) {
    const credential = await prisma.credential.update({
      where: { id },
      data: {
        status,
        ...(status === 'VERIFIED' && { verifiedAt: new Date() }),
      },
    });

    await createAuditLog(
      { action: 'VERIFY', entityType: 'Credential', entityId: id, newValue: credential },
      req
    );

    return credential;
  }

  async getExpiring(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    return prisma.credential.findMany({
      where: {
        expiryDate: { lte: cutoff, gte: new Date() },
        status: { not: 'EXPIRED' },
      },
      include: {
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }
}

export class VerificationService {
  async create(credentialId: string, source?: string) {
    return prisma.verificationRequest.create({
      data: { credentialId, source, status: 'PENDING' },
    });
  }

  async complete(id: string, verifiedById: string, status: string, remarks?: string, req?: Request) {
    const verification = await prisma.verificationRequest.update({
      where: { id },
      data: {
        status,
        verifiedById,
        completedAt: new Date(),
        remarks,
      },
    });

    if (status === 'COMPLETED') {
      await prisma.credential.update({
        where: { id: verification.credentialId },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      });
    }

    await createAuditLog(
      { action: 'VERIFY', entityType: 'VerificationRequest', entityId: id, newValue: verification },
      req
    );

    return verification;
  }

  async listPending() {
    return prisma.verificationRequest.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: {
        credential: {
          include: {
            provider: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { requestedAt: 'asc' },
    });
  }
}

export const credentialService = new CredentialService();
export const verificationService = new VerificationService();
