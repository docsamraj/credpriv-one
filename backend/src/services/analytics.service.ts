import prisma from '../lib/prisma';

export class AnalyticsService {
  async getOverview() {
    const now = new Date();
    const in30 = new Date(); in30.setDate(now.getDate() + 30);
    const in60 = new Date(); in60.setDate(now.getDate() + 60);
    const in90 = new Date(); in90.setDate(now.getDate() + 90);

    const [
      pendingApplications,
      pendingVerifications,
      committeeReadyCases,
      expiring30,
      expiring60,
      expiring90,
      temporaryPrivileges,
      overdueReappointments,
    ] = await Promise.all([
      prisma.application.count({ where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } } }),
      prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { committeeReady: true, status: 'COMMITTEE' } }),
      prisma.credential.count({ where: { expiryDate: { lte: in30, gte: now }, status: { not: 'EXPIRED' } } }),
      prisma.credential.count({ where: { expiryDate: { lte: in60, gte: now }, status: { not: 'EXPIRED' } } }),
      prisma.credential.count({ where: { expiryDate: { lte: in90, gte: now }, status: { not: 'EXPIRED' } } }),
      prisma.privilege.count({ where: { isTemporary: true, status: 'TEMPORARY' } }),
      prisma.application.count({
        where: { type: 'REAPPOINTMENT', status: { notIn: ['APPROVED', 'DENIED'] } },
      }),
    ]);

    return {
      pendingApplications,
      pendingVerifications,
      committeeReadyCases,
      expiringCredentials30: expiring30,
      expiringCredentials60: expiring60,
      expiringCredentials90: expiring90,
      temporaryPrivileges,
      overdueReappointments,
      avgTurnaroundDays: await this.avgTurnaroundDays(),
    };
  }

  async avgTurnaroundDays() {
    const approved = await prisma.application.findMany({
      where: { status: 'APPROVED', submittedAt: { not: null } },
      select: { submittedAt: true, updatedAt: true },
    });

    if (approved.length === 0) return 0;

    const totalDays = approved.reduce((sum, app) => {
      const days = (app.updatedAt.getTime() - app.submittedAt!.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);

    return Math.round((totalDays / approved.length) * 10) / 10;
  }

  async turnaroundByStage() {
    const stages = ['SUBMITTED', 'UNDER_VERIFICATION', 'COMMITTEE', 'MEC', 'BOARD', 'APPROVED'];
    const results = [];

    for (const stage of stages) {
      const count = await prisma.application.count({ where: { currentStage: stage } });
      results.push({ stage, avgDays: 0, count });
    }

    return results;
  }

  async pendingByDepartment() {
    return prisma.providerProfile.groupBy({
      by: ['departmentId'],
      _count: { id: true },
      where: {
        provider: {
          applications: { some: { status: { notIn: ['APPROVED', 'DENIED', 'DRAFT'] } } },
        },
      },
    });
  }

  async monthlyTrends(months = 6) {
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    const applications = await prisma.application.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, status: true },
    });

    const byMonth: Record<string, { submitted: number; approved: number; denied: number }> = {};

    for (const app of applications) {
      const key = `${app.createdAt.getFullYear()}-${String(app.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { submitted: 0, approved: 0, denied: 0 };
      byMonth[key].submitted++;
      if (app.status === 'APPROVED') byMonth[key].approved++;
      if (app.status === 'DENIED') byMonth[key].denied++;
    }

    return Object.entries(byMonth).map(([month, counts]) => ({ month, ...counts }));
  }

  async bottlenecks() {
    const pending = await prisma.application.groupBy({
      by: ['currentStage', 'status'],
      _count: { id: true },
      where: { status: { notIn: ['APPROVED', 'DENIED', 'DRAFT'] } },
    });

    return pending.map((p) => ({
      stage: p.currentStage || p.status,
      pendingCount: p._count.id,
      avgWaitDays: 0,
    }));
  }
}

export const analyticsService = new AnalyticsService();
