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

export interface RoleSuggestion {
  categoryCode: string;
  subtypeCode: string;
  clinicalUnit?: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'cloudflare' | 'heuristic';
  reason: string;
}

/** Keyword heuristics for Indian hospital JD role detection */
const ROLE_HINTS: Array<{ subtypeCode: string; categoryCode: string; patterns: RegExp[]; unit?: string }> = [
  { subtypeCode: 'PERFUSIONIST', categoryCode: 'TECHNICIAN', patterns: [/perfusion/i, /heart[- ]?lung/i, /cardiopulmonary bypass/i] },
  { subtypeCode: 'OT', categoryCode: 'TECHNICIAN', patterns: [/ot technician/i, /operation theatre tech/i, /operating room tech/i, /\bot tech\b/i], unit: 'Surgery OT' },
  { subtypeCode: 'CSSD', categoryCode: 'TECHNICIAN', patterns: [/cssd/i, /central sterile/i, /sterile supply/i] },
  { subtypeCode: 'CATHLAB', categoryCode: 'TECHNICIAN', patterns: [/cath\s*lab/i, /catheterization lab/i] },
  { subtypeCode: 'ICU', categoryCode: 'TECHNICIAN', patterns: [/\bicu tech/i, /intensive care.*tech/i] },
  { subtypeCode: 'CCU', categoryCode: 'TECHNICIAN', patterns: [/\bccu tech/i, /coronary care.*tech/i] },
  { subtypeCode: 'PHYSIOTHERAPIST', categoryCode: 'ALLIED_HEALTH', patterns: [/physiotherap/i, /\bpt\b.*rehab/i, /physical therap/i] },
  { subtypeCode: 'PHARMACIST', categoryCode: 'ALLIED_HEALTH', patterns: [/pharmacist/i, /pharmacy/i] },
  { subtypeCode: 'RADIOGRAPHER', categoryCode: 'ALLIED_HEALTH', patterns: [/radiograph/i, /x[- ]?ray tech/i, /imaging tech/i] },
  { subtypeCode: 'DIETICIAN', categoryCode: 'ALLIED_HEALTH', patterns: [/dietician/i, /dietitian/i, /clinical nutrition/i] },
  { subtypeCode: 'RESPIRATORY_THERAPIST', categoryCode: 'ALLIED_HEALTH', patterns: [/respiratory therap/i] },
  { subtypeCode: 'SPEECH_THERAPIST', categoryCode: 'ALLIED_HEALTH', patterns: [/speech therap/i, /speech.?language/i] },
  { subtypeCode: 'SENIOR_NURSE', categoryCode: 'NURSE', patterns: [/senior nurse/i, /staff nurse/i, /nursing officer/i, /\bgnm\b/i, /\bbsc nursing\b/i] },
  { subtypeCode: 'FRESHER_NURSE', categoryCode: 'NURSE', patterns: [/fresher nurse/i, /junior nurse/i, /trainee nurse/i] },
  { subtypeCode: 'FULL_TIME_CONSULTANT', categoryCode: 'DOCTOR', patterns: [/consultant/i, /\bmbbs\b/i, /\bmd\b/i, /\bms\b/i, /physician/i, /surgeon/i] },
  { subtypeCode: 'RMO', categoryCode: 'DOCTOR', patterns: [/\brmo\b/i, /resident medical/i] },
  { subtypeCode: 'HR_EXECUTIVE', categoryCode: 'HR', patterns: [/hr executive/i, /human resource/i, /\bhr\b.*recruit/i] },
  { subtypeCode: 'HR_MANAGER', categoryCode: 'HR', patterns: [/hr manager/i, /head of hr/i] },
  { subtypeCode: 'HOUSEKEEPING_STAFF', categoryCode: 'HOUSEKEEPING', patterns: [/housekeeping/i, /sanitation staff/i] },
  { subtypeCode: 'WARD_ATTENDANT', categoryCode: 'HOUSEKEEPING', patterns: [/ward (boy|attendant|ayah)/i] },
  { subtypeCode: 'SECURITY_GUARD', categoryCode: 'SECURITY', patterns: [/security guard/i, /security staff/i] },
  { subtypeCode: 'IT_SUPPORT', categoryCode: 'IT', patterns: [/it support/i, /helpdesk/i, /desktop support/i] },
  { subtypeCode: 'BIOMEDICAL_ENGINEER', categoryCode: 'ENGINEERING', patterns: [/biomedical/i] },
  { subtypeCode: 'ACCOUNTANT', categoryCode: 'FINANCE', patterns: [/accountant/i, /accounts executive/i] },
  { subtypeCode: 'BILLING_EXECUTIVE', categoryCode: 'FINANCE', patterns: [/billing/i, /tpa/i] },
  { subtypeCode: 'ADMIN_OFFICER', categoryCode: 'ADMINISTRATIVE', patterns: [/administrative officer/i, /admin officer/i] },
  { subtypeCode: 'FRONT_DESK', categoryCode: 'ADMINISTRATIVE', patterns: [/front desk/i, /reception/i] },
  { subtypeCode: 'STORE_KEEPER', categoryCode: 'STORES', patterns: [/store keeper/i, /stores/i, /inventory/i] },
  { subtypeCode: 'KITCHEN_STAFF', categoryCode: 'FOOD_SERVICES', patterns: [/kitchen staff/i, /cook\b/i, /food service/i] },
];

function detectClinicalUnit(text: string): string | undefined {
  if (/ctvs|cardio.?thoracic|cardiac surgery ot/i.test(text)) return 'CTVS OT';
  if (/surgery ot|general surgery ot|main ot/i.test(text)) return 'Surgery OT';
  if (/cssd/i.test(text)) return 'CSSD';
  if (/cath\s*lab/i.test(text)) return 'Cath Lab';
  if (/\bicu\b/i.test(text)) return 'ICU';
  if (/\bccu\b/i.test(text)) return 'CCU';
  return undefined;
}

export function heuristicSuggestRole(text: string): RoleSuggestion | null {
  const sample = text.slice(0, 8000);
  for (const hint of ROLE_HINTS) {
    if (hint.patterns.some((p) => p.test(sample))) {
      const unit = detectClinicalUnit(sample) || hint.unit;
      return {
        categoryCode: hint.categoryCode,
        subtypeCode: hint.subtypeCode,
        clinicalUnit: unit,
        confidence: 'medium',
        source: 'heuristic',
        reason: `Matched keywords for ${hint.subtypeCode.replace(/_/g, ' ').toLowerCase()}`,
      };
    }
  }
  return null;
}

export async function llmSuggestRole(
  text: string,
  catalogLines: string[]
): Promise<RoleSuggestion | null> {
  const raw = await callCloudflareChat([
    {
      role: 'system',
      content:
        'You map hospital job descriptions to a staff taxonomy. Respond with a single JSON object only.',
    },
    {
      role: 'user',
      content: `Given this job description, pick the best matching staff category and role from the catalog.

Catalog (categoryCode | subtypeCode | name):
${catalogLines.join('\n')}

Return ONLY JSON:
{"categoryCode":"...","subtypeCode":"...","clinicalUnit":"optional e.g. CTVS OT","confidence":"high|medium|low","reason":"short"}

Job description:
---
${text.slice(0, 8000)}
---`,
    },
  ]);

  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, string>;
    if (!parsed.categoryCode || !parsed.subtypeCode) return null;
    const conf = String(parsed.confidence || 'medium').toLowerCase();
    return {
      categoryCode: String(parsed.categoryCode).toUpperCase(),
      subtypeCode: String(parsed.subtypeCode).toUpperCase(),
      clinicalUnit: parsed.clinicalUnit?.trim() || detectClinicalUnit(text),
      confidence: conf === 'high' || conf === 'low' ? conf : 'medium',
      source: 'cloudflare',
      reason: parsed.reason || 'Suggested by AI from job description text',
    };
  } catch {
    return null;
  }
}
