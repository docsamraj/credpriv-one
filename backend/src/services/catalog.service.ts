import prisma from '../lib/prisma';
import { AppError } from '../utils/response';

export class CatalogService {
  async listCategories() {
    return prisma.staffCategory.findMany({
      where: { isActive: true },
      include: {
        subtypes: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getJobDescription(subtypeId: string) {
    const jd = await prisma.jobDescription.findFirst({
      where: { subtypeId, isActive: true },
      include: {
        items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        category: true,
        subtype: true,
      },
    });
    if (!jd) throw new AppError(404, 'Job description not found for this role');
    return jd;
  }

  async getRequiredDocuments(categoryId?: string, subtypeId?: string) {
    return prisma.requiredDocument.findMany({
      where: {
        ...(categoryId && { staffCategoryId: categoryId }),
        ...(subtypeId && { staffSubtypeId: subtypeId }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }
}

export const catalogService = new CatalogService();
