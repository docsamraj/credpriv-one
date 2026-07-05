import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

function collectPdfBuffer(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function writeHeading(doc: PdfDoc, text: string) {
  doc.moveDown(0.5).fontSize(14).font('Helvetica-Bold').text(text);
  doc.font('Helvetica').fontSize(10);
}

function writeLine(doc: PdfDoc, label: string, value: string) {
  doc.text(`${label}: ${value || '—'}`);
}

export async function generateReviewPacketPdf(packet: Record<string, unknown>): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const summary = packet.summary as Record<string, unknown>;
  const flags = (packet.flags as Array<{ severity: string; message: string }>) || [];
  const documentCompliance = packet.documentCompliance as Record<string, unknown>;
  const documents = (packet.documents as Array<{ name: string; type: string; uploadedAt: string }>) || [];
  const documentChecklist = (packet.documentChecklist as Array<{ name: string; uploaded: boolean }>) || [];
  const credentials = (packet.credentials as Array<{ title: string; status: string; expiryDate?: string }>) || [];
  const bgv = (packet.backgroundVerifications as Array<{ verificationType: string; status: string }>) || [];
  const jobDescription = packet.jobDescription as Record<string, unknown> | null;
  const privilegeMatrix = packet.privilegeMatrix as { items?: Array<{ name: string; suggestedLevel: string; requestedLevel?: string }> };

  doc.fontSize(18).font('Helvetica-Bold').text('CredPriv One — Committee Review Packet', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Generated: ${packet.generatedAt || new Date().toISOString()}`, { align: 'center' });
  doc.moveDown();

  writeHeading(doc, 'Applicant Summary');
  writeLine(doc, 'Name', String(summary.providerName || ''));
  writeLine(doc, 'Email', String(summary.email || ''));
  writeLine(doc, 'Role', `${summary.staffCategory || ''} — ${summary.staffSubtype || ''}`);
  if (summary.clinicalUnit) writeLine(doc, 'Clinical Unit', String(summary.clinicalUnit));
  writeLine(doc, 'Application Status', String(summary.status || ''));
  writeLine(doc, 'Workflow Phase', String(summary.workflowPhase || ''));

  if (flags.length) {
    writeHeading(doc, 'Review Flags');
    for (const f of flags) {
      doc.text(`[${f.severity}] ${f.message}`);
    }
  }

  writeHeading(doc, 'Document Compliance');
  writeLine(
    doc,
    'Status',
    `${documentCompliance.uploadedCount}/${documentCompliance.requiredCount} uploaded${documentCompliance.complete ? ' — Complete' : ' — Incomplete'}`
  );
  for (const item of documentChecklist) {
    doc.text(`${item.uploaded ? '✓' : '✗'} ${item.name}`);
  }

  if (documents.length) {
    writeHeading(doc, 'Uploaded Files');
    for (const d of documents) {
      doc.text(`• ${d.name} (${d.type}) — ${new Date(d.uploadedAt).toLocaleDateString()}`);
    }
  }

  if (credentials.length) {
    writeHeading(doc, 'Credentials & PSV');
    for (const c of credentials) {
      doc.text(`• ${c.title} — ${c.status}${c.expiryDate ? ` (exp ${new Date(c.expiryDate).toLocaleDateString()})` : ''}`);
    }
  }

  if (bgv.length) {
    writeHeading(doc, 'Background Verification');
    for (const b of bgv) {
      doc.text(`• ${b.verificationType}: ${b.status}`);
    }
  }

  if (jobDescription) {
    writeHeading(doc, 'Job Description');
    writeLine(doc, 'Title', String(jobDescription.title || ''));
    if (jobDescription.clinicalUnit) writeLine(doc, 'Unit', String(jobDescription.clinicalUnit));
    if (jobDescription.sourceFileName) writeLine(doc, 'Source File', String(jobDescription.sourceFileName));
    const jdItems = (jobDescription.items as Array<{ name: string; defaultLevel: string }>) || [];
    for (const item of jdItems) {
      doc.text(`• ${item.name} — suggested: ${String(item.defaultLevel).replace(/_/g, ' ')}`);
    }
  }

  if (privilegeMatrix?.items?.length) {
    writeHeading(doc, 'Privilege Matrix');
    for (const item of privilegeMatrix.items) {
      doc.text(
        `• ${item.name} — suggested: ${item.suggestedLevel.replace(/_/g, ' ')}${item.requestedLevel ? `, requested: ${item.requestedLevel.replace(/_/g, ' ')}` : ''}`
      );
    }
  }

  const decisions = ((packet.review as Record<string, unknown>)?.decisions as Array<{ decisionType: string; rationale?: string }>) || [];
  if (decisions.length) {
    writeHeading(doc, 'Committee Decisions');
    for (const d of decisions) {
      doc.text(`• ${d.decisionType}${d.rationale ? `: ${d.rationale}` : ''}`);
    }
  }

  doc.moveDown().fontSize(8).fillColor('#666').text('Confidential — CredPriv One Credentialing System', { align: 'center' });

  return collectPdfBuffer(doc);
}

export async function generateMeetingMinutesPdf(opts: {
  committeeName: string;
  meetingTitle: string;
  minutes: string;
  sentAt?: Date;
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  doc.fontSize(18).font('Helvetica-Bold').text('Minutes of Meeting', { align: 'center' });
  doc.fontSize(10).font('Helvetica').moveDown();
  writeLine(doc, 'Committee', opts.committeeName);
  writeLine(doc, 'Meeting', opts.meetingTitle);
  writeLine(doc, 'Date', (opts.sentAt || new Date()).toLocaleString());
  doc.moveDown();
  writeHeading(doc, 'Minutes');
  doc.text(opts.minutes, { align: 'left' });
  doc.moveDown().fontSize(8).fillColor('#666').text('Sent via CredPriv One', { align: 'center' });

  return collectPdfBuffer(doc);
}
