import { ParsedPrivilegeItem } from '@credpriv/shared';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callCloudflareChat(messages: ChatMessage[]): Promise<string | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return null;

  const model = process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct';
  const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
  if (gatewayId) headers['cf-aig-gateway-id'] = gatewayId;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens: 4096, temperature: 0.2 }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('Cloudflare AI error:', res.status, errText.slice(0, 500));
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    result?: { response?: string };
  };

  return data.choices?.[0]?.message?.content ?? data.result?.response ?? null;
}

export function parsePrivilegeJsonFromLlm(raw: string): ParsedPrivilegeItem[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
    return parsed
      .map((row) => ({
        name: String(row.name || row.privilege || row.title || '').trim(),
        code: row.code ? String(row.code).trim() : undefined,
        description: row.description ? String(row.description).trim() : undefined,
        defaultLevel: normalizeLevel(String(row.defaultLevel || row.level || 'NONE')),
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

function normalizeLevel(level: string): ParsedPrivilegeItem['defaultLevel'] {
  const u = level.toUpperCase().replace(/\s+/g, '_');
  if (u.includes('FULL') && !u.includes('SUPERVISION')) return 'FULL';
  if (u.includes('SUPERVIS') || u.includes('UNDER')) return 'UNDER_SUPERVISION';
  return 'NONE';
}

export function heuristicParsePrivileges(text: string): ParsedPrivilegeItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const items: ParsedPrivilegeItem[] = [];
  for (const line of lines) {
    const bullet = line.replace(/^[-*•\d.)\s]+/, '').trim();
    if (bullet.length < 5) continue;

    const levelMatch = bullet.match(/\b(full|under supervision|supervised|none|not permitted)\b/i);
    let defaultLevel: ParsedPrivilegeItem['defaultLevel'] = 'NONE';
    if (levelMatch) {
      defaultLevel = normalizeLevel(levelMatch[1]);
    }

    const name = bullet
      .replace(/\b(full|under supervision|supervised|none|not permitted)\b/gi, '')
      .replace(/[:–-]\s*$/, '')
      .trim();

    if (name.length < 4) continue;

    items.push({
      name,
      code: name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40),
      defaultLevel,
    });
  }

  return items.slice(0, 50);
}
