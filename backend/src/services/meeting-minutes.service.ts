import prisma from '../lib/prisma';
import { AppError } from '../utils/response';
import { createAuditLog } from '../middleware/audit';
import { Request } from 'express';
import {
  memberDisplayName,
  memberEmail,
  sendMeetingMinutesNotifications,
} from './notification-delivery.service';

export class MeetingMinutesService {
  async getMeetingForMom(meetingId: string) {
    const meeting = await prisma.committeeMeeting.findUnique({
      where: { id: meetingId },
      include: {
        committee: {
          include: {
            members: {
              where: { isActive: true },
              include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
            },
          },
        },
        reviews: {
          include: {
            application: {
              include: {
                provider: { include: { user: { select: { firstName: true, lastName: true } } } },
              },
            },
          },
        },
      },
    });
    if (!meeting) throw new AppError(404, 'Meeting not found');

    return {
      ...meeting,
      committee: {
        ...meeting.committee,
        members: meeting.committee.members.map((m) => ({
          ...m,
          displayName: memberDisplayName(m),
          email: memberEmail(m),
        })),
      },
    };
  }

  async concludeAndSendMinutes(
    meetingId: string,
    data: {
      minutes: string;
      presentMemberIds: string[];
      additionalEmails?: string[];
    },
    req?: Request
  ) {
    if (!data.minutes?.trim()) throw new AppError(400, 'Meeting minutes text is required');
    if (!data.presentMemberIds?.length) {
      throw new AppError(400, 'Select at least one present committee member');
    }

    const meeting = await prisma.committeeMeeting.findUnique({
      where: { id: meetingId },
      include: {
        committee: {
          include: {
            members: {
              where: { isActive: true },
              include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    if (!meeting) throw new AppError(404, 'Meeting not found');

    const presentSet = new Set(data.presentMemberIds);
    const presentMembers = meeting.committee.members.filter((m) => presentSet.has(m.id));
    if (presentMembers.length === 0) {
      throw new AppError(400, 'Invalid present member selection');
    }

    const recipientUserIds = presentMembers
      .map((m) => m.userId)
      .filter((id): id is string => !!id);

    const additionalEmails = (data.additionalEmails || [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    const updated = await prisma.committeeMeeting.update({
      where: { id: meetingId },
      data: {
        status: 'COMPLETED',
        minutes: data.minutes.trim(),
        minutesPreparedAt: new Date(),
        minutesSentAt: new Date(),
        presentMemberIds: data.presentMemberIds,
        additionalRecipients: additionalEmails,
      },
    });

    const sent = await sendMeetingMinutesNotifications({
      meetingId,
      meetingTitle: meeting.title,
      committeeName: meeting.committee.name,
      minutes: data.minutes.trim(),
      recipientUserIds,
      additionalEmails,
    });

    await createAuditLog(
      {
        action: 'UPDATE',
        entityType: 'CommitteeMeeting',
        entityId: meetingId,
        newValue: { minutesSent: true, recipientCount: sent.length },
        metadata: { action: 'mom_sent' },
      },
      req
    );

    return { meeting: updated, notificationsSent: sent.length, recipients: sent };
  }
}

export const meetingMinutesService = new MeetingMinutesService();
