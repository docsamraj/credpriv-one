import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { WorkflowPhase } from '@credpriv/shared';

export class DepartmentService {
  async getChairedDepartments(userId: string) {
    return prisma.department.findMany({
      where: { chairUserId: userId, isActive: true },
      select: { id: true, name: true, code: true },
    });
  }

  async listPendingApprovals(userId: string) {
    const departments = await this.getChairedDepartments(userId);
    const departmentIds = departments.map((d) => d.id);
    if (departmentIds.length === 0) return [];

    return prisma.application.findMany({
      where: {
        workflowPhase: WorkflowPhase.DEPARTMENT_APPROVAL,
        provider: { profile: { departmentId: { in: departmentIds } } },
      },
      include: {
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            profile: { include: { department: true, staffCategory: true, staffSubtype: true } },
          },
        },
        staffCategory: true,
        staffSubtype: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async assertChairForApplication(userId: string, applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { provider: { include: { profile: true } } },
    });
    if (!app) throw new AppError(404, 'Application not found');
    const deptId = app.provider.profile?.departmentId;
    if (!deptId) throw new AppError(400, 'Applicant has no department assigned');

    const dept = await prisma.department.findFirst({
      where: { id: deptId, chairUserId: userId, isActive: true },
    });
    if (!dept) throw new AppError(403, 'You are not the department head for this applicant');

    return { app, department: dept };
  }
}

export const departmentService = new DepartmentService();
