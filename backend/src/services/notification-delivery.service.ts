import prisma from '../lib/prisma';
import { sendEmail } from './email.service';
import { dispatchWebhookEvent } from './webhook-dispatch.service';
import { IntegrationWebhookEvent } from '@credpriv/shared';
import { generateMeetingMinutesPdf } from './pdf-document.service';

/** Resolve email for a committee member (user account or invitee metadata). */
function memberEmail(member: {
  user?: { email: string } | null;
  memberName?: string | null;
  id: string;
}): string | null {
  return member.user?.email ?? null;
}

function memberDisplayName(member: {
  memberName?: string | null;
  user?: { firstName: string; lastName: string } | null;
}) {
  if (member.memberName?.trim()) return member.memberName.trim();
  if (member.user) return `${member.user.firstName} ${member.user.lastName}`;
  return 'Committee Member';
}

export async function sendMeetingMinutesNotifications(opts: {
  meetingId: string;
  meetingTitle: string;
  committeeName: string;
  minutes: string;
  recipientUserIds: string[];
  additionalEmails: string[];
}) {
  const sent: Array<{ type: string; target: string }> = [];
  const emailBody = buildMomEmailBody(opts.committeeName, opts.meetingTitle, opts.minutes);
  const subject = `Minutes of Meeting — ${opts.meetingTitle}`;
  const pdfAttachment = await generateMeetingMinutesPdf({
    committeeName: opts.committeeName,
    meetingTitle: opts.meetingTitle,
    minutes: opts.minutes,
    sentAt: new Date(),
  });
  const pdfFilename = `MoM-${opts.meetingTitle.replace(/[^\w\-]+/g, '_').slice(0, 40)}.pdf`;

  for (const userId of opts.recipientUserIds) {
    await prisma.notification.create({
      data: {
        userId,
        channel: 'IN_APP',
        title: subject,
        message: `Minutes for ${opts.committeeName} meeting are available.\n\n${opts.minutes.slice(0, 500)}${opts.minutes.length > 500 ? '…' : ''}`,
        metadata: { meetingId: opts.meetingId, type: 'MEETING_MINUTES' },
      },
    });
    sent.push({ type: 'IN_APP', target: userId });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const result = await sendEmail({
        to: user.email,
        subject,
        text: `${emailBody}\n\n(A PDF copy of these minutes is attached.)`,
        attachments: [{ filename: pdfFilename, content: pdfAttachment, contentType: 'application/pdf' }],
      });
      sent.push({ type: result.mode === 'smtp' ? 'EMAIL' : 'EMAIL_STUB', target: user.email });
    }
  }

  for (const email of opts.additionalEmails) {
    const result = await sendEmail({
      to: email,
      subject,
      text: `${emailBody}\n\n(A PDF copy of these minutes is attached.)`,
      attachments: [{ filename: pdfFilename, content: pdfAttachment, contentType: 'application/pdf' }],
    });
    sent.push({ type: result.mode === 'smtp' ? 'EMAIL' : 'EMAIL_STUB', target: email });
  }

  await dispatchWebhookEvent(IntegrationWebhookEvent.MEETING_MINUTES_SENT, {
    meetingId: opts.meetingId,
    meetingTitle: opts.meetingTitle,
    committeeName: opts.committeeName,
    recipientCount: sent.length,
  });

  return sent;
}

function buildMomEmailBody(committeeName: string, title: string, minutes: string) {
  return `CredPriv One — Minutes of Meeting

Committee: ${committeeName}
Meeting: ${title}

${minutes}

— Sent automatically by CredPriv One`;
}

export { memberEmail, memberDisplayName };
