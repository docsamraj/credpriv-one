import { Request } from 'express';
import { UserRole } from '@credpriv/shared';
import prisma from '../lib/prisma';
import { AppError } from '../utils/response';

const STAFF_ROLES: UserRole[] = [
  UserRole.CREDENTIALING_STAFF,
  UserRole.COMMITTEE_MEMBER,
  UserRole.MEC_MEMBER,
  UserRole.DEPARTMENT_CHAIR,
  UserRole.SYSTEM_ADMIN,
  UserRole.ADMINISTRATOR,
  UserRole.QUALITY_ACCREDITATION,
];

export function isStaffUser(roles: string[] | UserRole[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r as UserRole));
}

export async function getProviderIdForUser(userId: string): Promise<string> {
  const provider = await prisma.provider.findUnique({ where: { userId } });
  if (!provider) throw new AppError(404, 'Provider profile not found');
  return provider.id;
}

/** Providers may only access their own providerId; staff may access any. */
export async function assertCanAccessProvider(req: Request, providerId: string): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (isStaffUser(req.user.roles)) return;
  const ownId = await getProviderIdForUser(req.user.userId);
  if (ownId !== providerId) throw new AppError(403, 'Access denied');
}

export async function assertCanAccessApplication(req: Request, applicationId: string): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (isStaffUser(req.user.roles)) return;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { providerId: true },
  });
  if (!app) throw new AppError(404, 'Application not found');

  const ownId = await getProviderIdForUser(req.user.userId);
  if (ownId !== app.providerId) throw new AppError(403, 'Access denied');
}
