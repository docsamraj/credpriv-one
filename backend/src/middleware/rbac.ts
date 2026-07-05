import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@credpriv/shared';
import prisma from '../lib/prisma';
import { AppError } from '../utils/response';

/**
 * RBAC permission map — extend as modules grow.
 * Format: resource.action
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.PROVIDER]: [
    'application.read', 'application.create', 'application.update',
    'document.upload', 'document.read',
    'credential.read', 'privilege.request', 'profile.update',
  ],
  [UserRole.CREDENTIALING_STAFF]: [
    'application.read', 'application.update', 'application.verify',
    'credential.read', 'credential.update', 'credential.verify',
    'document.read', 'verification.create', 'verification.update',
    'provider.read', 'task.read', 'task.update',
    'committee.mark_ready', 'job_description.manage', 'committee.manage',
    'integration.read', 'integration.export', 'integration.admin',
  ],
  [UserRole.DEPARTMENT_CHAIR]: [
    'application.read', 'provider.read', 'privilege.read',
    'committee.review', 'committee.decide', 'department.approve',
  ],
  [UserRole.COMMITTEE_MEMBER]: [
    'application.read', 'provider.read', 'credential.read',
    'committee.review', 'committee.decide', 'committee.meeting.read',
    'job_description.manage',
  ],
  [UserRole.MEC_MEMBER]: [
    'application.read', 'provider.read', 'credential.read', 'privilege.read',
    'committee.review', 'committee.decide', 'committee.meeting.read',
  ],
  [UserRole.ADMINISTRATOR]: [
    'application.read', 'provider.read', 'analytics.read',
    'committee.read', 'audit.read', 'job_description.manage',
    'integration.read', 'integration.export',
  ],
  [UserRole.QUALITY_ACCREDITATION]: [
    'application.read', 'provider.read', 'analytics.read',
    'audit.read', 'monitoring.read',
    'integration.read', 'integration.export',
  ],
  [UserRole.SYSTEM_ADMIN]: ['*'],
};

export function hasPermission(roles: UserRole[], permission: string): boolean {
  if (roles.includes(UserRole.SYSTEM_ADMIN)) return true;

  return roles.some((role) => {
    const perms = ROLE_PERMISSIONS[role] || [];
    return perms.includes('*') || perms.includes(permission);
  });
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!hasPermission(req.user.roles as UserRole[], permission)) {
      return next(new AppError(403, `Permission denied: ${permission}`));
    }

    next();
  };
}

/**
 * Load user roles from DB and attach to request.
 * Use after authenticate middleware for fresh role data.
 */
export async function loadUserRoles(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next();

  try {
    const userRoles = await prisma.userRole.findMany({
      where: { userId: req.user.userId },
      select: { role: true },
    });
    req.user.roles = userRoles.map((r) => r.role as UserRole);
    next();
  } catch (err) {
    next(err);
  }
}
