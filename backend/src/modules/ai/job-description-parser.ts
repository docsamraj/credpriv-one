import { JobDescriptionParseResult, ParsedPrivilegeItem } from '@credpriv/shared';
import { extractTextFromFile } from './document-text';
import { callCloudflareChat, heuristicParsePrivileges, parsePrivilegeJsonFromLlm } from './cloudflare-llm';

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

export class JobDescriptionParserService {
  async parseUploadedFile(opts: {
    filePath: string;
    mimeType?: string;
    originalName: string;
    roleName: string;
    categoryName: string;
    clinicalUnit?: string;
    titleHint?: string;
  }): Promise<JobDescriptionParseResult & { extractedText: string }> {
    const extractedText = await extractTextFromFile(opts.filePath, opts.mimeType);
    if (!extractedText.trim()) {
      throw new Error('Could not extract text from the uploaded file. Try a text-based PDF or DOCX.');
    }

    const clinicalUnit = opts.clinicalUnit?.trim() || '';
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
    };
  }
}

export const jobDescriptionParserService = new JobDescriptionParserService();
