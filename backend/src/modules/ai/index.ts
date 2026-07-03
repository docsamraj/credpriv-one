/**
 * AI Module — Modular AI helpers for CredPriv One
 * TODO: Integrate real OCR (Tesseract, AWS Textract, Google Vision)
 * TODO: Integrate LLM for case summaries (OpenAI, Anthropic, local models)
 * TODO: ML-based risk scoring model
 */

import { AiCaseSummary, AiFlag, OcrExtractionResult } from '@credpriv/shared';
import prisma from '../../lib/prisma';

export class OcrService {
  /**
   * Extract text/fields from uploaded document.
   * Stub — returns mock extraction; replace with real OCR pipeline.
   */
  async extractFromDocument(documentId: string): Promise<OcrExtractionResult> {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error('Document not found');

    // TODO: Call OCR provider API
    const extractedFields: Record<string, string> = {
      documentType: doc.type,
      fileName: doc.name,
    };

    if (doc.type === 'LICENSE') {
      extractedFields.licenseNumber = 'MOCK-LIC-12345';
      extractedFields.expiryDate = '2027-12-31';
      extractedFields.issuingBody = 'State Medical Board';
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { ocrData: extractedFields },
    });

    return { documentId, extractedFields, confidence: 0.85 };
  }
}

export class CaseSummaryService {
  /**
   * Generate AI case summary for committee review packet.
   * Stub — rule-based flags; upgrade to LLM summarization.
   */
  async generateSummary(providerId: string): Promise<AiCaseSummary> {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        user: true,
        profile: { include: { department: true, specialty: true } },
        credentials: true,
        privileges: true,
        documents: true,
      },
    });

    if (!provider) throw new Error('Provider not found');

    const flags: AiFlag[] = [];
    const now = new Date();

    // Rule-based flags
    const requiredTypes = ['LICENSE', 'DEGREE', 'IDENTITY', 'INSURANCE'];
    const uploadedTypes = new Set(provider.documents.map((d: { type: string }) => d.type));
    for (const type of requiredTypes) {
      if (!uploadedTypes.has(type)) {
        flags.push({
          type: 'MISSING_DOC',
          severity: 'HIGH',
          message: `Missing required document: ${type}`,
          field: type,
        });
      }
    }

    for (const cred of provider.credentials) {
      if (cred.expiryDate && cred.expiryDate < now) {
        flags.push({
          type: 'EXPIRED',
          severity: 'HIGH',
          message: `Expired credential: ${cred.title}`,
          field: cred.id,
        });
      } else if (cred.expiryDate) {
        const daysUntil = (cred.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil <= 90) {
          flags.push({
            type: 'RISK',
            severity: daysUntil <= 30 ? 'HIGH' : 'MEDIUM',
            message: `Credential expiring in ${Math.round(daysUntil)} days: ${cred.title}`,
            field: cred.id,
          });
        }
      }

      if (cred.status === 'PENDING') {
        flags.push({
          type: 'RISK',
          severity: 'MEDIUM',
          message: `Unverified credential: ${cred.title}`,
          field: cred.id,
        });
      }
    }

    const summary = [
      `Provider: Dr. ${provider.user.firstName} ${provider.user.lastName}`,
      provider.profile?.specialty ? `Specialty: ${provider.profile.specialty.name}` : null,
      provider.profile?.department ? `Department: ${provider.profile.department.name}` : null,
      `Credentials: ${provider.credentials.length} on file`,
      `Privileges requested: ${provider.privileges.filter((p: { status: string }) => p.status === 'REQUESTED').length}`,
      `Flags: ${flags.length} issue(s) identified`,
    ]
      .filter(Boolean)
      .join('. ');

    return {
      providerId,
      summary,
      flags,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const ocrService = new OcrService();
export const caseSummaryService = new CaseSummaryService();
