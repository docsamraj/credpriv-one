import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { ParsedPrivilegeItem } from '@credpriv/shared';

export class JobDescriptionService {
  async list(filters?: { subtypeId?: string; categoryId?: string }) {
    return prisma.jobDescription.findMany({
      where: {
        isActive: true,
        ...(filters?.subtypeId && { subtypeId: filters.subtypeId }),
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
      },
      include: {
        subtype: true,
        category: true,
        items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: [{ subtype: { name: 'asc' } }, { clinicalUnit: 'asc' }],
    });
  }

  async publish(data: {
    categoryId: string;
    subtypeId: string;
    clinicalUnit?: string;
    title: string;
    description?: string;
    items: ParsedPrivilegeItem[];
    sourceFileName?: string;
    sourceFilePath?: string;
    sourceMimeType?: string;
    extractedText?: string;
  }) {
    if (!data.items.length) {
      throw new AppError(400, 'At least one privilege line item is required');
    }

    const clinicalUnit = (data.clinicalUnit || '').trim();

    const jd = await prisma.jobDescription.upsert({
      where: { subtypeId_clinicalUnit: { subtypeId: data.subtypeId, clinicalUnit } },
      update: {
        title: data.title,
        description: data.description,
        sourceFileName: data.sourceFileName,
        sourceFilePath: data.sourceFilePath,
        sourceMimeType: data.sourceMimeType,
        extractedText: data.extractedText,
        aiParsedAt: new Date(),
        isActive: true,
      },
      create: {
        categoryId: data.categoryId,
        subtypeId: data.subtypeId,
        clinicalUnit,
        title: data.title,
        description: data.description,
        sourceFileName: data.sourceFileName,
        sourceFilePath: data.sourceFilePath,
        sourceMimeType: data.sourceMimeType,
        extractedText: data.extractedText,
        aiParsedAt: new Date(),
      },
    });

    await prisma.jobDescriptionItem.deleteMany({ where: { jobDescriptionId: jd.id } });
    await prisma.jobDescriptionItem.createMany({
      data: data.items.map((item, i) => ({
        jobDescriptionId: jd.id,
        name: item.name,
        code: item.code,
        description: item.description,
        defaultLevel: item.defaultLevel,
        sortOrder: i + 1,
      })),
    });

    return prisma.jobDescription.findUnique({
      where: { id: jd.id },
      include: { items: { orderBy: { sortOrder: 'asc' } }, subtype: true, category: true },
    });
  }
}

export const jobDescriptionService = new JobDescriptionService();
