import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { CommitteeMemberRole, UserRole } from '@credpriv/shared';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';

const ROLE_ORDER: Record<string, number> = {
  CHAIR: 1,
  CO_CHAIR: 2,
  SECRETARY: 3,
  MEMBER: 4,
  SPECIAL_INVITEE: 5,
};

function parseDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function displayName(member: {
  memberName?: string | null;
  user?: { firstName: string; lastName: string } | null;
}) {
  if (member.memberName?.trim()) return member.memberName.trim();
  if (member.user) return `${member.user.firstName} ${member.user.lastName}`.trim();
  return 'Unknown';
}

export class CommitteeMemberService {
  async listCommitteesWithRoster() {
    const committees = await prisma.committee.findMany({
      where: { isActive: true },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return committees.map((c) => ({
      ...c,
      members: c.members
        .map((m) => ({ ...m, displayName: displayName(m) }))
        .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)),
    }));
  }

  async searchUsers(query?: string) {
    return prisma.user.findMany({
      where: {
        isActive: true,
        ...(query && {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: { select: { role: true } },
      },
      take: 20,
      orderBy: { lastName: 'asc' },
    });
  }

  async addMember(
    committeeId: string,
    data: {
      userId?: string;
      memberName?: string;
      degrees?: string;
      designation?: string;
      role: string;
      engagementStart?: string;
      engagementEnd?: string;
    },
    req?: Request
  ) {
    const committee = await prisma.committee.findUnique({ where: { id: committeeId } });
    if (!committee) throw new AppError(404, 'Committee not found');

    const role = data.role || CommitteeMemberRole.MEMBER;
    const isSpecialInvitee = role === CommitteeMemberRole.SPECIAL_INVITEE;

    if (!data.userId && !data.memberName?.trim()) {
      throw new AppError(400, 'Provide a linked user or a name for the committee member');
    }

    if (data.userId) {
      const existing = await prisma.committeeMember.findUnique({
        where: { committeeId_userId: { committeeId, userId: data.userId } },
      });
      if (existing?.isActive) throw new AppError(409, 'User is already on this committee');
      if (existing && !existing.isActive) {
        const reactivated = await prisma.committeeMember.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            leftAt: null,
            memberName: data.memberName?.trim() || null,
            degrees: data.degrees?.trim() || null,
            designation: data.designation?.trim() || null,
            role,
            engagementStart: parseDate(data.engagementStart),
            engagementEnd: parseDate(data.engagementEnd),
          },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        });
        return { ...reactivated, displayName: displayName(reactivated) };
      }

      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        include: { roles: true },
      });
      if (!user) throw new AppError(404, 'User not found');

      if (!isSpecialInvitee) {
        const hasCommitteeRole = user.roles.some((r) =>
          [UserRole.COMMITTEE_MEMBER, UserRole.MEC_MEMBER, UserRole.DEPARTMENT_CHAIR].includes(r.role as UserRole)
        );
        if (!hasCommitteeRole) {
          await prisma.userRole.create({
            data: { userId: user.id, role: UserRole.COMMITTEE_MEMBER },
          });
        }
      }
    }

    const member = await prisma.committeeMember.create({
      data: {
        committeeId,
        userId: data.userId || null,
        memberName: data.memberName?.trim() || null,
        degrees: data.degrees?.trim() || null,
        designation: data.designation?.trim() || null,
        role,
        engagementStart: parseDate(data.engagementStart),
        engagementEnd: parseDate(data.engagementEnd),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await createAuditLog(
      { action: 'CREATE', entityType: 'CommitteeMember', entityId: member.id, newValue: member },
      req
    );

    return { ...member, displayName: displayName(member) };
  }

  async updateMember(
    committeeId: string,
    memberId: string,
    data: {
      memberName?: string;
      degrees?: string;
      designation?: string;
      role?: string;
      engagementStart?: string;
      engagementEnd?: string;
    },
    req?: Request
  ) {
    const member = await prisma.committeeMember.findFirst({
      where: { id: memberId, committeeId },
    });
    if (!member) throw new AppError(404, 'Committee member not found');

    const updated = await prisma.committeeMember.update({
      where: { id: memberId },
      data: {
        ...(data.memberName !== undefined && { memberName: data.memberName.trim() || null }),
        ...(data.degrees !== undefined && { degrees: data.degrees.trim() || null }),
        ...(data.designation !== undefined && { designation: data.designation.trim() || null }),
        ...(data.role && { role: data.role }),
        ...(data.engagementStart !== undefined && { engagementStart: parseDate(data.engagementStart) ?? null }),
        ...(data.engagementEnd !== undefined && { engagementEnd: parseDate(data.engagementEnd) ?? null }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await createAuditLog(
      { action: 'UPDATE', entityType: 'CommitteeMember', entityId: memberId, newValue: updated },
      req
    );

    return { ...updated, displayName: displayName(updated) };
  }

  async removeMember(committeeId: string, memberId: string, req?: Request) {
    const member = await prisma.committeeMember.findFirst({
      where: { id: memberId, committeeId },
    });
    if (!member) throw new AppError(404, 'Committee member not found');

    const updated = await prisma.committeeMember.update({
      where: { id: memberId },
      data: { isActive: false, leftAt: new Date() },
    });

    await createAuditLog(
      { action: 'DELETE', entityType: 'CommitteeMember', entityId: memberId, oldValue: member },
      req
    );

    return updated;
  }
}

export const committeeMemberService = new CommitteeMemberService();
