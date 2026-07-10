import { JobDescriptionParseResult, ParsedPrivilegeItem, STAFF_SUBTYPES } from '@credpriv/shared';
import { extractTextFromFile } from './document-text';
import {
  callCloudflareChat,
  heuristicParsePrivileges,
  heuristicSuggestRole,
  llmSuggestRole,
  parsePrivilegeJsonFromLlm,
  RoleSuggestion,
} from './cloudflare-llm';

function buildPrompt(
  text: string,
  roleName: string,
  clinicalUnit: string,
  categoryName: string
): string {
  return `You are a hospital credentialing expert. Extract clinical privileges from this job description.

Staff category: ${categoryName}
Role: ${roleName}
Clinical unit / context: ${clinicalUnit || 'General'}

Return ONLY a JSON array (no markdown) where each item has:
- "name": privilege line item (string)
- "code": short SCREAMING_SNAKE code (string, optional)
- "description": brief scope note (string, optional)
- "defaultLevel": one of "FULL", "UNDER_SUPERVISION", or "NONE"

Focus on privileging scope (what they may do independently, under supervision, or not at all).
Differentiate unit-specific duties when the document mentions OT type (e.g. CTVS vs general surgery), CSSD, perfusion, cath lab, etc.

Job description text:
---
${text.slice(0, 12000)}
---`;
}

function catalogLines(): string[] {
  return STAFF_SUBTYPES.map(
    (s) => `${s.category} | ${s.code} | ${s.name}${s.parentGroup ? ` (${s.parentGroup})` : ''}`
  );
}

function resolveSuggestion(suggestion: RoleSuggestion | null): RoleSuggestion | null {
  if (!suggestion) return null;
  const match = STAFF_SUBTYPES.find(
    (s) => s.code === suggestion.subtypeCode && s.category === suggestion.categoryCode
  );
  if (match) return suggestion;
  const bySubtype = STAFF_SUBTYPES.find((s) => s.code === suggestion.subtypeCode);
  if (bySubtype) {
    return {
      ...suggestion,
      categoryCode: bySubtype.category,
      subtypeCode: bySubtype.code,
    };
  }
  return null;
}

export class JobDescriptionParserService {
  async suggestRoleFromText(extractedText: string): Promise<RoleSuggestion | null> {
    const llm = await llmSuggestRole(extractedText, catalogLines());
    const resolvedLlm = resolveSuggestion(llm);
    if (resolvedLlm) return resolvedLlm;
    return resolveSuggestion(heuristicSuggestRole(extractedText));
  }

  async parseUploadedFile(opts: {
    filePath: string;
    mimeType?: string;
    originalName: string;
    roleName: string;
    categoryName: string;
    clinicalUnit?: string;
    titleHint?: string;
    /** When true, also infer category/role from text */
    suggestRole?: boolean;
  }): Promise<JobDescriptionParseResult & { extractedText: string; roleSuggestion: RoleSuggestion | null }> {
    const extractedText = await extractTextFromFile(opts.filePath, opts.mimeType);
    if (!extractedText.trim()) {
      throw new Error('Could not extract text from the uploaded file. Try a text-based PDF or DOCX.');
    }

    const roleSuggestion =
      opts.suggestRole !== false ? await this.suggestRoleFromText(extractedText) : null;

    const clinicalUnit =
      opts.clinicalUnit?.trim() ||
      roleSuggestion?.clinicalUnit ||
      '';

    let items: ParsedPrivilegeItem[] = [];
    let parsedBy: JobDescriptionParseResult['parsedBy'] = 'heuristic';

    const llmRaw = await callCloudflareChat([
      {
        role: 'system',
        content:
          'You extract hospital privileging matrices from job descriptions. Respond with valid JSON array only.',
      },
      {
        role: 'user',
        content: buildPrompt(extractedText, opts.roleName, clinicalUnit, opts.categoryName),
      },
    ]);

    if (llmRaw) {
      items = parsePrivilegeJsonFromLlm(llmRaw);
      if (items.length > 0) parsedBy = 'cloudflare';
    }

    if (items.length === 0) {
      items = heuristicParsePrivileges(extractedText);
      parsedBy = 'heuristic';
    }

    const title =
      opts.titleHint?.trim() ||
      `${opts.roleName}${clinicalUnit ? ` — ${clinicalUnit}` : ''} — Clinical Privileges`;

    return {
      title,
      clinicalUnit: clinicalUnit || undefined,
      items,
      extractedTextPreview: extractedText.slice(0, 2000),
      extractedText,
      parsedBy,
      suggestedCategoryCode: roleSuggestion?.categoryCode,
      suggestedSubtypeCode: roleSuggestion?.subtypeCode,
      suggestedClinicalUnit: roleSuggestion?.clinicalUnit,
      suggestionConfidence: roleSuggestion?.confidence,
      suggestionSource: roleSuggestion?.source,
      suggestionReason: roleSuggestion?.reason,
      roleSuggestion,
    };
  }
}

export const jobDescriptionParserService = new JobDescriptionParserService();
