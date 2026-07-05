import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import type { DocumentComplianceReport } from '@credpriv/shared';
import { allowsMultipleDocumentUploads } from '@credpriv/shared';

/** When false (default), document checklist is advisory — upload what you have. */
export function isDocumentGateEnforced(): boolean {
  return process.env.ENFORCE_DOCUMENT_GATE === 'true';
}

export class DocumentComplianceService {
  async getCompliance(applicationId: string): Promise<DocumentComplianceReport> {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, providerId: true, staffCategoryId: true, staffSubtypeId: true },
    });
    if (!app) throw new AppError(404, 'Application not found');
    if (!app.staffCategoryId) {
      return {
        applicationId,
        complete: true,
        gateEnforced: isDocumentGateEnforced(),
        requiredCount: 0,
        uploadedCount: 0,
        missing: [],
        items: [],
        allDocuments: [],
      };
    }

    const checklist = await prisma.requiredDocument.findMany({
      where: {
        OR: [
          { staffCategoryId: app.staffCategoryId, staffSubtypeId: null },
          ...(app.staffSubtypeId ? [{ staffSubtypeId: app.staffSubtypeId }] : []),
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });

    const allUploaded = await prisma.document.findMany({
      where: { providerId: app.providerId },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, name: true, type: true, uploadedAt: true },
    });

    const items = checklist.map((doc) => {
      const files = allUploaded.filter((d) => d.type === doc.type);
      return {
        type: doc.type,
        name: doc.name,
        isRequired: doc.isRequired,
        uploaded: files.length > 0,
        fileCount: files.length,
        allowsMultiple: allowsMultipleDocumentUploads(doc.type),
        uploadedFiles: files.map((f) => ({
          id: f.id,
          name: f.name,
          uploadedAt: f.uploadedAt.toISOString(),
        })),
      };
    });

    const gateEnforced = isDocumentGateEnforced();
    const missing = items.filter((i) => i.isRequired && !i.uploaded);

    return {
      applicationId,
      complete: gateEnforced ? missing.length === 0 && items.some((i) => i.isRequired) : true,
      gateEnforced,
      requiredCount: items.filter((i) => i.isRequired).length,
      uploadedCount: items.filter((i) => i.uploaded).length,
      missing: gateEnforced ? missing : items.filter((i) => !i.uploaded),
      items,
      allDocuments: allUploaded.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    };
  }

  async assertComplete(applicationId: string) {
    const report = await this.getCompliance(applicationId);
    if (!isDocumentGateEnforced()) return report;

    if (!report.complete) {
      const names = report.missing.map((m: { name: string }) => m.name).join(', ');
      throw new AppError(
        400,
        `Required documents missing before credentialing can complete: ${names || 'upload all required documents'}`
      );
    }
    return report;
  }
}

export const documentComplianceService = new DocumentComplianceService();
