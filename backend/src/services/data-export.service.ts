import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import {
  DataExchangeDirection,
  DataExchangeFormat,
  ExternalEntityType,
  IntegrationSystemType,
} from '@credpriv/shared';
import { Request } from 'express';

function hashPayload(payload: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export class DataExportService {
  async logExport(opts: {
    entityType: string;
    entityId?: string;
    format: string;
    userId?: string;
    systemId?: string;
    payload: unknown;
    req?: Request;
  }) {
    return prisma.dataExchangeLog.create({
      data: {
        direction: DataExchangeDirection.OUTBOUND,
        format: opts.format,
        entityType: opts.entityType,
        entityId: opts.entityId,
        systemId: opts.systemId,
        userId: opts.userId,
        payloadHash: hashPayload(opts.payload),
        status: 'SUCCESS',
        metadata: {
          ip: opts.req?.ip,
          userAgent: opts.req?.headers['user-agent'],
        },
      },
    });
  }

  async exportProviderBundle(providerId: string, userId?: string, req?: Request) {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } },
        profile: {
          include: {
            department: true,
            specialty: true,
            staffCategory: true,
            staffSubtype: true,
          },
        },
        credentials: true,
        documents: { select: { id: true, name: true, type: true, uploadedAt: true } },
        applications: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            staffSubtype: true,
            jobDescription: true,
            privilegeRequests: { include: { jobDescriptionItem: true } },
          },
        },
      },
    });
    if (!provider) throw new AppError(404, 'Provider not found');

    const externalIds = await prisma.externalIdentifier.findMany({
      where: { entityType: ExternalEntityType.PROVIDER, entityId: providerId },
      include: { system: { select: { code: true, name: true, systemType: true } } },
    });

    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      meta: {
        source: 'CredPriv One',
        version: '1.0',
        format: DataExchangeFormat.FHIR_R4,
      },
      identifier: externalIds.map((e) => ({
        system: e.system.code,
        systemType: e.system.systemType,
        value: e.externalId,
      })),
      entry: [
        {
          resourceType: 'Practitioner',
          id: provider.id,
          active: provider.user.isActive,
          name: [{ family: provider.user.lastName, given: [provider.user.firstName] }],
          telecom: [{ system: 'email', value: provider.user.email }],
          identifier: [
            ...(provider.npi ? [{ system: 'NPI', value: provider.npi }] : []),
            ...(provider.licenseNo ? [{ system: 'MEDICAL_LICENSE', value: provider.licenseNo }] : []),
          ],
          qualification: provider.credentials.map((c) => ({
            code: c.type,
            display: c.title,
            period: { start: c.issueDate?.toISOString(), end: c.expiryDate?.toISOString() },
            status: c.status,
          })),
          extension: [
            {
              url: 'https://credpriv.one/fhir/StructureDefinition/staff-role',
              valueString: provider.profile?.staffSubtype?.name,
            },
            {
              url: 'https://credpriv.one/fhir/StructureDefinition/staff-category',
              valueString: provider.profile?.staffCategory?.name,
            },
          ],
        },
        ...provider.applications.map((app) => ({
          resourceType: 'CredentialingApplication',
          id: app.id,
          status: app.status,
          workflowPhase: app.workflowPhase,
          clinicalUnit: app.clinicalUnit || undefined,
          role: app.staffSubtype?.name,
          jobDescription: app.jobDescription?.title,
          privileges: app.privilegeRequests.map((pr) => ({
            item: pr.jobDescriptionItem.name,
            requested: pr.requestedLevel,
            granted: pr.grantedLevel,
          })),
        })),
      ],
    };

    await this.logExport({
      entityType: ExternalEntityType.PROVIDER,
      entityId: providerId,
      format: DataExchangeFormat.FHIR_R4,
      userId,
      payload: bundle,
      req,
    });

    return bundle;
  }

  async exportApplicationPacket(applicationId: string, userId?: string, req?: Request) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            documents: { select: { type: true, name: true, uploadedAt: true } },
          },
        },
        staffCategory: true,
        staffSubtype: true,
        jobDescription: { include: { items: true } },
        privilegeRequests: { include: { jobDescriptionItem: true } },
        committeeReviews: { include: { decisions: true } },
      },
    });
    if (!app) throw new AppError(404, 'Application not found');

    const packet = {
      resourceType: 'CredentialingPacket',
      id: applicationId,
      timestamp: new Date().toISOString(),
      meta: { source: 'CredPriv One', version: '1.0', format: DataExchangeFormat.JSON },
      provider: {
        name: `${app.provider.user.firstName} ${app.provider.user.lastName}`,
        email: app.provider.user.email,
      },
      application: {
        type: app.type,
        status: app.status,
        workflowPhase: app.workflowPhase,
        clinicalUnit: app.clinicalUnit || null,
        staffCategory: app.staffCategory?.name,
        staffSubtype: app.staffSubtype?.name,
        jobDescription: app.jobDescription?.title,
        submittedAt: app.submittedAt,
        credentialingCompleteAt: app.credentialingCompleteAt,
        documentsCompleteAt: app.documentsCompleteAt,
      },
      documents: app.provider.documents,
      privilegeRequests: app.privilegeRequests.map((pr) => ({
        item: pr.jobDescriptionItem.name,
        requestedLevel: pr.requestedLevel,
        grantedLevel: pr.grantedLevel,
        status: pr.status,
      })),
      committeeReviews: app.committeeReviews.map((r) => ({
        status: r.status,
        decisions: r.decisions.map((d) => ({ type: d.decisionType, rationale: d.rationale })),
      })),
    };

    await this.logExport({
      entityType: ExternalEntityType.APPLICATION,
      entityId: applicationId,
      format: DataExchangeFormat.JSON,
      userId,
      payload: packet,
      req,
    });

    return packet;
  }

  async listIntegrationSystems() {
    return prisma.integrationSystem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async upsertExternalIdentifier(data: {
    systemCode: string;
    entityType: string;
    entityId: string;
    externalId: string;
  }) {
    const system = await prisma.integrationSystem.findUnique({ where: { code: data.systemCode } });
    if (!system) throw new AppError(404, 'Integration system not found');

    return prisma.externalIdentifier.upsert({
      where: {
        systemId_entityType_externalId: {
          systemId: system.id,
          entityType: data.entityType,
          externalId: data.externalId,
        },
      },
      update: { entityId: data.entityId },
      create: {
        systemId: system.id,
        entityType: data.entityType,
        entityId: data.entityId,
        externalId: data.externalId,
      },
    });
  }
}

export const dataExportService = new DataExportService();

export { IntegrationSystemType };
