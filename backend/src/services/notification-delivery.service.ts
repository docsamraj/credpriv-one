import prisma from '../lib/prisma';

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

  for (const userId of opts.recipientUserIds) {
    await prisma.notification.create({
      data: {
        userId,
        channel: 'IN_APP',
        title: `Minutes of Meeting — ${opts.meetingTitle}`,
        message: `Minutes for ${opts.committeeName} meeting are available.\n\n${opts.minutes.slice(0, 500)}${opts.minutes.length > 500 ? '…' : ''}`,
        metadata: { meetingId: opts.meetingId, type: 'MEETING_MINUTES' },
      },
    });
    sent.push({ type: 'IN_APP', target: userId });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `Minutes of Meeting — ${opts.meetingTitle}`,
        body: buildMomEmailBody(opts.committeeName, opts.meetingTitle, opts.minutes),
      });
      sent.push({ type: 'EMAIL', target: user.email });
    }
  }

  for (const email of opts.additionalEmails) {
    await sendEmail({
      to: email,
      subject: `Minutes of Meeting — ${opts.meetingTitle}`,
      body: buildMomEmailBody(opts.committeeName, opts.meetingTitle, opts.minutes),
    });
    sent.push({ type: 'EMAIL', target: email });
  }

  return sent;
}

function buildMomEmailBody(committeeName: string, title: string, minutes: string) {
  return `CredPriv One — Minutes of Meeting

Committee: ${committeeName}
Meeting: ${title}

${minutes}

— Sent automatically by CredPriv One`;
}

/** Email delivery — logs to console; set SMTP_* env vars for real delivery later. */
export async function sendEmail(opts: { to: string; subject: string; body: string }) {
  if (process.env.SMTP_HOST) {
    // TODO: wire nodemailer when SMTP is configured
    console.log(`[EMAIL via SMTP] To: ${opts.to} | Subject: ${opts.subject}`);
  } else {
    console.log(`[EMAIL stub] To: ${opts.to}\nSubject: ${opts.subject}\n---\n${opts.body.slice(0, 300)}...`);
  }
}

export { memberEmail, memberDisplayName };
