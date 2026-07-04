import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { seedStaffCatalog } from '../lib/seed-staff-catalog';

export class CatalogService {
  async listCategories() {
    let categories = await prisma.staffCategory.findMany({
      where: { isActive: true },
      include: {
        subtypes: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (categories.length === 0) {
      await seedStaffCatalog(prisma);
      categories = await prisma.staffCategory.findMany({
        where: { isActive: true },
        include: {
          subtypes: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return categories;
  }

  async getJobDescription(subtypeId: string, clinicalUnit?: string) {
    const unit = (clinicalUnit || '').trim();
    const jd = await prisma.jobDescription.findFirst({
      where: { subtypeId, clinicalUnit: unit, isActive: true },
      include: {
        items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        category: true,
        subtype: true,
      },
    });
    if (!jd) throw new AppError(404, 'Job description not found for this role and unit');
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
