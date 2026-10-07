// Print a paper on as many A4 pages as it needs.
//
// The paper is copied into a hidden frame holding nothing else (the app's
// scrolling layout made browsers print only the first page). The page margin
// is set to zero, which also stops browsers printing their own date / title /
// address lines; the real margins come from a table whose header and footer
// rows repeat on every page. Each block of the paper (letterhead, section
// heading, question) is its own row, so page breaks fall between questions.

const TOP_MM = 9;
const BOTTOM_MM = 11;
const SIDE_MM = 11;

const PRINT_CSS = `
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ndv-print-pages { width: 100%; border-collapse: collapse; }
.ndv-print-pages > thead > tr > td, .ndv-print-pages > tbody > tr > td, .ndv-print-pages > tfoot > tr > td { padding: 0 ${SIDE_MM}mm; vertical-align: top; }
.ndv-print-top { height: ${TOP_MM}mm; }
.ndv-print-bottom { height: ${BOTTOM_MM}mm; }
.ndv-print-pages > tbody > tr { break-inside: avoid; page-break-inside: avoid; }
.ndv-print-pages > tbody > tr.ndv-break { break-before: page; page-break-before: always; }
.ndv-print-pages > tbody > tr.ndv-tall { break-inside: auto; page-break-inside: auto; }
.ndv-paper { box-shadow: none !important; border-radius: 0 !important; max-width: none !important; padding: 0 !important; margin: 0 !important; font-size: 11.5pt; }
.ndv-paper-question { margin-bottom: 9pt; }
.ndv-figure svg { max-height: 95mm; }
`;

const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

/** The paper's blocks as table rows; forced page breaks become breaks before a row. */
export function paperRows(paper) {
  const blocks = [...paper.querySelectorAll('[data-print-block]')].filter(block => !block.parentElement?.closest('[data-print-block]'));
  return blocks.map(block => {
    const breakBefore = block.classList.contains('ndv-page-break');
    // Questions with long essays or several parts may run over a page.
    const tall = (block.textContent || '').length > 1600 || block.querySelectorAll('.ndv-paper-part').length > 2 || block.querySelectorAll('.ndv-answer-lines').length > 3;
    return `<tr class="${breakBefore ? 'ndv-break' : ''} ${tall ? 'ndv-tall' : ''}"><td><div class="ndv-paper">${block.outerHTML}</div></td></tr>`;
  }).join('');
}

/**
 * The page's styles, carried inside the print document itself. Linking to the
 * stylesheet files was not enough: browsers printed before they had loaded,
 * and the paper came out unformatted (numbered option lists, a huge logo,
 * many pages). Rules that cannot be read (another site's stylesheet) stay links.
 */
export function pageStyles(doc = document) {
  const inline = [];
  const links = [];
  for (const sheet of Array.from(doc.styleSheets || [])) {
    let rules = null;
    try { rules = sheet.cssRules; } catch { rules = null; }
    if (rules) inline.push(Array.from(rules).map(rule => rule.cssText).join('\n'));
    else if (sheet.href) links.push(`<link rel="stylesheet" href="${escapeHtml(sheet.href)}">`);
  }
  // Nothing readable (e.g. a test page): fall back to copying the tags.
  if (!inline.length && !links.length) return [...doc.querySelectorAll('link[rel="stylesheet"], style')].map(node => node.outerHTML).join('\n');
  return `${links.join('\n')}<style>${inline.join('\n').replace(/<\/style/gi, '<\\/style')}</style>`;
}

/** Build the printable document for a rendered paper element. */
export function printableHtml(paper, title) {
  const styles = pageStyles();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><base href="${window.location.origin}/">${styles}<style>${PRINT_CSS}</style></head>
<body><table class="ndv-print-pages"><thead><tr><td><div class="ndv-print-top"></div></td></tr></thead><tbody>${paperRows(paper)}</tbody><tfoot><tr><td><div class="ndv-print-bottom"></div></td></tr></tfoot></table></body></html>`;
}

function whenLoaded(doc) {
  const images = [...doc.images].map(image => (image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })));
  // Any stylesheet that is still a link must finish loading before printing.
  const sheets = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(link => (link.sheet ? Promise.resolve() : new Promise(resolve => { link.onload = resolve; link.onerror = resolve; })));
  const fonts = doc.fonts?.ready ? doc.fonts.ready.catch(() => null) : Promise.resolve();
  return Promise.race([Promise.all([...images, ...sheets, fonts]), new Promise(resolve => setTimeout(resolve, 6000))]);
}

/** Print (or "Save as PDF") every page of a paper element. */
export async function printPaper(paper, title = 'Ndovera paper') {
  if (!paper) return;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '210mm', height: '297mm', border: '0', visibility: 'hidden' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(printableHtml(paper, title));
  doc.close();
  await whenLoaded(doc);
  const view = frame.contentWindow;
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  view.addEventListener('afterprint', cleanup, { once: true });
  view.focus();
  view.print();
  // Browsers that do not fire afterprint: remove the frame after a while.
  setTimeout(() => { if (frame.isConnected) frame.remove(); }, 120000);
}
