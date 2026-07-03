import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';

export class ProviderService {
  async list(page = 1, pageSize = 20, filters?: { departmentId?: string; search?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.search) {
      where.user = {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }
    if (filters?.departmentId) {
      where.profile = { departmentId: filters.departmentId };
    }

    const [items, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          profile: { include: { department: true, specialty: true } },
          applications: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.provider.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string) {
    const provider = await prisma.provider.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        profile: { include: { department: true, specialty: true } },
        credentials: { orderBy: { expiryDate: 'asc' } },
        privileges: { include: { procedure: true, category: true } },
        applications: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!provider) throw new AppError(404, 'Provider not found');
    return provider;
  }

  async updateProfile(providerId: string, data: Record<string, unknown>, req?: Request) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new AppError(404, 'Provider not found');

    const profile = await prisma.providerProfile.upsert({
      where: { providerId },
      create: { providerId, ...data },
      update: data,
      include: { department: true, specialty: true },
    });

    await createAuditLog(
      { action: 'UPDATE', entityType: 'ProviderProfile', entityId: profile.id, newValue: profile },
      req
    );

    return profile;
  }
}

export const providerService = new ProviderService();
