import crypto from 'crypto';
import prisma from '../lib/prisma';
import { DataExchangeDirection, DataExchangeFormat, IntegrationWebhookEvent } from '@credpriv/shared';

export async function dispatchWebhookEvent(
  event: IntegrationWebhookEvent | string,
  payload: Record<string, unknown>
) {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { event, isActive: true },
    include: { system: { select: { id: true, code: true, name: true } } },
  });

  if (subscriptions.length === 0) return [];

  const results: Array<{ subscriptionId: string; status: string }> = [];

  for (const sub of subscriptions) {
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
    let status = 'SUCCESS';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sub.secretHash) {
        headers['X-CredPriv-Signature'] = crypto.createHmac('sha256', sub.secretHash).update(body).digest('hex');
      }

      const res = await fetch(sub.targetUrl, { method: 'POST', headers, body });
      if (!res.ok) status = 'FAILED';
    } catch {
      status = 'FAILED';
    }

    await prisma.dataExchangeLog.create({
      data: {
        direction: DataExchangeDirection.OUTBOUND,
        format: DataExchangeFormat.JSON,
        entityType: 'WEBHOOK',
        entityId: sub.id,
        systemId: sub.systemId,
        payloadHash: crypto.createHash('sha256').update(body).digest('hex').slice(0, 16),
        status,
        metadata: { event, targetUrl: sub.targetUrl },
      },
    });

    results.push({ subscriptionId: sub.id, status });
  }

  return results;
}
