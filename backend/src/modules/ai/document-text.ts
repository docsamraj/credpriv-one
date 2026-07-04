import fs from 'fs';
import path from 'path';

const SUPPORTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
]);

const EXT_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

export function resolveMimeType(filePath: string, mimeType?: string): string {
  if (mimeType && SUPPORTED_MIME.has(mimeType)) return mimeType;
  const ext = path.extname(filePath).toLowerCase();
  return EXT_MAP[ext] || mimeType || 'application/octet-stream';
}

export async function extractTextFromFile(filePath: string, mimeType?: string): Promise<string> {
  const resolved = resolveMimeType(filePath, mimeType);

  if (resolved === 'text/plain' || resolved === 'text/csv') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (resolved === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text || '';
  }

  if (
    resolved === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    resolved === 'application/msword'
  ) {
    if (resolved === 'application/msword') {
      throw new Error('Legacy .doc files are not supported. Please save as .docx and re-upload.');
    }
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  if (
    resolved === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    resolved === 'application/vnd.ms-excel'
  ) {
    if (resolved === 'application/vnd.ms-excel') {
      throw new Error('Legacy .xls files are not supported. Please save as .xlsx and re-upload.');
    }
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      parts.push(`Sheet: ${sheetName}`);
      parts.push(XLSX.utils.sheet_to_csv(sheet));
    }
    return parts.join('\n\n');
  }

  throw new Error(`Unsupported file type: ${resolved}. Use PDF, DOCX, XLSX, TXT, or CSV.`);
}

export function isSupportedJobDescriptionFile(filename: string, mimeType?: string): boolean {
  try {
    resolveMimeType(filename, mimeType);
    const ext = path.extname(filename).toLowerCase();
    return ext in EXT_MAP || (mimeType ? SUPPORTED_MIME.has(mimeType) : false);
  } catch {
    return false;
  }
}
