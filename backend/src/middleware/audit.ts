import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { paramId } from '../utils/params';

export interface AuditContext {
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(ctx: AuditContext, req?: Request) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req?.user?.userId,
        action: ctx.action,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        oldValue: ctx.oldValue ? JSON.parse(JSON.stringify(ctx.oldValue)) : undefined,
        newValue: ctx.newValue ? JSON.parse(JSON.stringify(ctx.newValue)) : undefined,
        ipAddress: req?.ip || req?.socket?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        metadata: (ctx.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

export function auditMiddleware(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId =
          (body as { data?: { id?: string } })?.data?.id ||
          (req.params.id ? paramId(req.params.id) : undefined);

        createAuditLog(
          {
            action,
            entityType,
            entityId,
            newValue: body,
            metadata: { method: req.method, path: req.path },
          },
          req
        );
      }
      return originalJson(body);
    };

    next();
  };
}
