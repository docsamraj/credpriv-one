import prisma from '../lib/prisma';
import { notificationService } from '../services/notification.service';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function runCredentialExpiryReminders() {
  const rules = await prisma.notificationRule.findMany({
    where: { event: 'CREDENTIAL_EXPIRING', isActive: true, daysBefore: { not: null } },
  });

  if (rules.length === 0) {
    return { sent: 0, skipped: 0, rules: 0 };
  }

  let sent = 0;
  let skipped = 0;
  const today = startOfDay(new Date());

  for (const rule of rules) {
    const daysBefore = rule.daysBefore!;
    const targetDay = new Date(today);
    targetDay.setDate(targetDay.getDate() + daysBefore);

    const credentials = await prisma.credential.findMany({
      where: {
        expiryDate: { gte: startOfDay(targetDay), lte: endOfDay(targetDay) },
        status: { notIn: ['EXPIRED', 'REJECTED'] },
      },
      include: {
        provider: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    for (const cred of credentials) {
      const existing = await prisma.credentialExpiryReminder.findUnique({
        where: { credentialId_ruleId: { credentialId: cred.id, ruleId: rule.id } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const expiryStr = cred.expiryDate ? cred.expiryDate.toLocaleDateString() : 'unknown date';
      const title = `Credential expiring in ${daysBefore} days`;
      const message = `${cred.title} expires on ${expiryStr}. Please renew and upload updated documentation.`;
      const emailSubject = `CredPriv One — ${title}`;
      const emailBody = `Dear ${cred.provider.user.firstName},\n\n${message}\n\nCredential: ${cred.title}\nIssuing body: ${cred.issuingBody || '—'}\n\n— CredPriv One`;

      if (rule.channel === 'EMAIL') {
        await notificationService.notifyUser({
          userId: cred.provider.user.id,
          title,
          message,
          metadata: { credentialId: cred.id, ruleId: rule.id, daysBefore, type: 'CREDENTIAL_EXPIRING' },
          event: 'CREDENTIAL_EXPIRING',
          emailSubject,
          emailBody,
        });
      } else {
        await notificationService.notifyUser({
          userId: cred.provider.user.id,
          title,
          message,
          metadata: { credentialId: cred.id, ruleId: rule.id, daysBefore, type: 'CREDENTIAL_EXPIRING' },
        });
      }

      const staffUsers = await prisma.userRole.findMany({
        where: { role: 'CREDENTIALING_STAFF' },
        select: { userId: true },
      });
      for (const { userId } of staffUsers) {
        if (userId === cred.provider.user.id) continue;
        await prisma.notification.create({
          data: {
            userId,
            channel: 'IN_APP',
            title: `Staff alert — ${title}`,
            message: `${cred.provider.user.firstName} ${cred.provider.user.lastName}: ${message}`,
            metadata: { credentialId: cred.id, providerId: cred.providerId, type: 'CREDENTIAL_EXPIRING_STAFF' },
          },
        });
      }

      await prisma.credentialExpiryReminder.create({
        data: { credentialId: cred.id, ruleId: rule.id },
      });
      sent += 1;
    }
  }

  console.log(`[Credential expiry job] sent=${sent} skipped=${skipped} rules=${rules.length}`);
  return { sent, skipped, rules: rules.length };
}
