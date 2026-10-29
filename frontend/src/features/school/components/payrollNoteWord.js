// Payroll notes as Microsoft Word files: a .docx (Word 2007 and later) and a .doc
// (older Word, and Word on most phones). Both carry the letterhead, the instruction,
// the staff table with account details and net pay, the total and the signature.

function naira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

const HEADINGS = ['S/N', 'Staff Name', 'Role', 'Bank Name', 'Account Name', 'Account No.', 'Net Pay'];

function tableRows(rows) {
  return rows.map((row, index) => [
    String(index + 1),
    row.name || '',
    row.role || 'staff',
    row.bankName || 'Pending update',
    row.accountName || 'Pending update',
    row.accountNumber || 'Pending update',
    naira(row.net ?? row.computedNet ?? 0),
  ]);
}

function contactLine(contactInfo = {}, branding = {}) {
  return [contactInfo.address, contactInfo.phone, contactInfo.email, branding.website].filter(Boolean).join(' · ');
}

/** The note as a .doc: HTML that Word opens as a document. */
export function payrollNoteDocBlob({ rows = [], monthLabel, branding = {}, contactInfo = {}, noteText, signerName, signerRole, signatureDate }) {
  const total = rows.reduce((sum, row) => sum + Number(row?.net ?? row?.computedNet ?? 0), 0);
  const cell = 'border:1px solid #cbd5e1;padding:6px;font-size:10pt;';
  const body = `
    <h1 style="color:#800000;font-size:18pt;margin:0">${escapeHtml(branding.schoolName || 'School Payroll Office')}</h1>
    <p style="margin:2px 0;font-size:10pt">Monthly Payroll Notes — ${escapeHtml(monthLabel)}</p>
    <p style="margin:2px 0;font-size:9pt;color:#475569">${escapeHtml(contactLine(contactInfo, branding))}</p>
    <hr/>
    <p style="font-size:11pt;white-space:pre-wrap">${escapeHtml(noteText || `Please process payroll for ${monthLabel} as listed below and confirm each successful credit.`)}</p>
    <table style="border-collapse:collapse;width:100%">
      <tr>${HEADINGS.map(heading => `<th style="${cell}background:#800020;color:#ffffff;text-align:left">${heading}</th>`).join('')}</tr>
      ${tableRows(rows).map(cells => `<tr>${cells.map(value => `<td style="${cell}">${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
      <tr><td colspan="6" style="${cell}text-align:right;font-weight:bold">Total Net Pay</td><td style="${cell}font-weight:bold">${escapeHtml(naira(total))}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:10pt">Prepared by</p>
    <p style="font-size:16pt;color:#800000;font-style:italic;margin:0">${escapeHtml(signerName)}</p>
    <p style="font-size:10pt;margin:0">${escapeHtml(signerRole || 'Authorized signatory')} — signed ${escapeHtml(signatureDate)}</p>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Payroll Notes ${escapeHtml(monthLabel)}</title></head><body style="font-family:Calibri,Arial,sans-serif">${body}</body></html>`;
  return new Blob(['﻿', html], { type: 'application/msword' });
}

/** The note as a .docx. */
export async function payrollNoteDocxBlob({ rows = [], monthLabel, branding = {}, contactInfo = {}, noteText, signerName, signerRole, signatureDate }) {
  const D = await import('docx');
  const total = rows.reduce((sum, row) => sum + Number(row?.net ?? row?.computedNet ?? 0), 0);
  const border = { style: D.BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const textCell = (text, { bold = false, color, fill, span } = {}) => new D.TableCell({
    borders,
    columnSpan: span,
    shading: fill ? { type: D.ShadingType.CLEAR, color: 'auto', fill } : undefined,
    children: [new D.Paragraph({ children: [new D.TextRun({ text: String(text), bold, color, size: 18 })] })],
  });
  const table = new D.Table({
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    rows: [
      new D.TableRow({ tableHeader: true, children: HEADINGS.map(heading => textCell(heading, { bold: true, color: 'FFFFFF', fill: '800020' })) }),
      ...tableRows(rows).map(cells => new D.TableRow({ children: cells.map(value => textCell(value)) })),
      new D.TableRow({ children: [textCell('Total Net Pay', { bold: true, span: 6 }), textCell(naira(total), { bold: true })] }),
    ],
  });
  const paragraph = (text, options = {}) => new D.Paragraph({ spacing: { after: 120 }, children: [new D.TextRun({ text, ...options })] });
  const doc = new D.Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
      children: [
        paragraph(branding.schoolName || 'School Payroll Office', { bold: true, size: 36, color: '800000' }),
        paragraph(`Monthly Payroll Notes — ${monthLabel}`, { size: 22 }),
        ...(contactLine(contactInfo, branding) ? [paragraph(contactLine(contactInfo, branding), { size: 18, color: '475569' })] : []),
        ...String(noteText || `Please process payroll for ${monthLabel} as listed below and confirm each successful credit.`)
          .split('\n').map(line => paragraph(line, { size: 22 })),
        table,
        new D.Paragraph({ spacing: { before: 400 }, children: [new D.TextRun({ text: 'Prepared by', size: 20 })] }),
        paragraph(String(signerName || ''), { italics: true, size: 32, color: '800000' }),
        paragraph(`${signerRole || 'Authorized signatory'} — signed ${signatureDate}`, { size: 20 }),
      ],
    }],
  });
  return D.Packer.toBlob(doc);
}
