import prisma from '../lib/prisma';
import { sendEmail } from './email.service';
import { dispatchWebhookEvent } from './webhook-dispatch.service';
import { IntegrationWebhookEvent } from '@credpriv/shared';

export class NotificationService {
  async listForUser(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async notifyUser(opts: {
    userId: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    emailSubject?: string;
    emailBody?: string;
    event?: string;
  }) {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        channel: 'IN_APP',
        title: opts.title,
        message: opts.message,
        metadata: (opts.metadata || {}) as object,
      },
    });

    if (opts.event) {
      const emailRule = await prisma.notificationRule.findFirst({
        where: { event: opts.event, channel: 'EMAIL', isActive: true },
      });
      if (emailRule && opts.emailSubject && opts.emailBody) {
        const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } });
        if (user?.email) {
          await sendEmail({ to: user.email, subject: opts.emailSubject, text: opts.emailBody });
        }
      }
    }
  }

  async notifyApplicationStatusChange(applicationId: string, status: string, message: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { provider: { include: { user: { select: { id: true, email: true, firstName: true } } } } },
    });
    if (!app) return;

    const title = `Application ${status.replace(/_/g, ' ')}`;
    await this.notifyUser({
      userId: app.provider.user.id,
      title,
      message,
      metadata: { applicationId, status, type: 'APPLICATION_STATUS' },
      event: 'APPLICATION_STATUS_CHANGED',
      emailSubject: `CredPriv One — ${title}`,
      emailBody: `Dear ${app.provider.user.firstName},\n\n${message}\n\n— CredPriv One`,
    });

    await dispatchWebhookEvent(
      status === 'APPROVED'
        ? IntegrationWebhookEvent.APPLICATION_APPROVED
        : IntegrationWebhookEvent.APPLICATION_SUBMITTED,
      {
        applicationId,
        providerId: app.providerId,
        status,
        workflowPhase: app.workflowPhase,
      }
    );
  }
}

export const notificationService = new NotificationService();
