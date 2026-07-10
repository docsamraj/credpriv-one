import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken } from '../middleware/auth';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { UserRole } from '@credpriv/shared';
import { Request } from 'express';

export const PRIVACY_NOTICE_VERSION = process.env.PRIVACY_NOTICE_VERSION || '2026-07-10';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    privacyNoticeAccepted?: boolean;
    role?: UserRole;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Email already registered');

    if (!data.privacyNoticeAccepted) {
      throw new AppError(400, 'You must accept the privacy notice to register');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const role = UserRole.PROVIDER;

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        privacyNoticeAccepted: true,
        consentAt: new Date(),
        consentVersion: PRIVACY_NOTICE_VERSION,
        roles: { create: { role } },
        provider: { create: {} },
      },
      include: { roles: true, provider: true },
    });

    const roles = user.roles.map((r) => r.role as UserRole);
    const token = signToken({ userId: user.id, email: user.email, roles });

    await createAuditLog({
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { email: user.email, consentVersion: PRIVACY_NOTICE_VERSION },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        providerId: user.provider?.id,
        privacyNoticeAccepted: true,
      },
      accessToken: token,
    };
  }

  async login(email: string, password: string, req?: Request) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true, provider: true },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (user.erasureCompletedAt) {
      throw new AppError(401, 'Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const roles = user.roles.map((r) => r.role as UserRole);
    const token = signToken({ userId: user.id, email: user.email, roles });

    await createAuditLog(
      { action: 'LOGIN', entityType: 'User', entityId: user.id },
      req
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        providerId: user.provider?.id,
        privacyNoticeAccepted: user.privacyNoticeAccepted,
        erasureRequestedAt: user.erasureRequestedAt,
      },
      accessToken: token,
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        provider: { include: { profile: { include: { department: true, specialty: true } } } },
      },
    });

    if (!user) throw new AppError(404, 'User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => r.role),
      provider: user.provider,
      privacyNoticeAccepted: user.privacyNoticeAccepted,
      consentAt: user.consentAt,
      consentVersion: user.consentVersion,
      erasureRequestedAt: user.erasureRequestedAt,
    };
  }
}

export const authService = new AuthService();
