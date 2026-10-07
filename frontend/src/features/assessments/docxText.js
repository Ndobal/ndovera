import JSZip from 'jszip';

// Text from a Word (.docx) paper, read in the browser.
// Word keeps automatic numbering ("1.", "(a)", "A.") outside the text, so it is
// rebuilt here from the document's numbering definitions — otherwise the
// question numbers and option letters would be lost. Tables become Markdown
// tables; pictures become a marker so the teacher knows to add them again.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function attr(node, name) {
  return node?.getAttributeNS(W, name) ?? node?.getAttribute(`w:${name}`) ?? null;
}

function children(node, name) {
  return Array.from(node?.childNodes || []).filter(child => child.localName === name);
}

function child(node, name) {
  return children(node, name)[0] || null;
}

const ROMAN = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
function roman(value) {
  let n = value;
  let out = '';
  for (const [size, text] of ROMAN) while (n >= size) { out += text; n -= size; }
  return out;
}

function formatNumber(value, format) {
  switch (format) {
    case 'lowerLetter': return String.fromCharCode(96 + (((value - 1) % 26) + 1));
    case 'upperLetter': return String.fromCharCode(64 + (((value - 1) % 26) + 1));
    case 'lowerRoman': return roman(value);
    case 'upperRoman': return roman(value).toUpperCase();
    case 'bullet': return '';
    default: return String(value);
  }
}

/** numId → level → { format, text, start }, from word/numbering.xml. */
function readNumbering(xml) {
  if (!xml) return new Map();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const abstracts = new Map();
  for (const abstract of Array.from(doc.getElementsByTagNameNS(W, 'abstractNum'))) {
    const levels = new Map();
    for (const level of children(abstract, 'lvl')) {
      levels.set(Number(attr(level, 'ilvl') || 0), {
        format: attr(child(level, 'numFmt'), 'val') || 'decimal',
        text: attr(child(level, 'lvlText'), 'val') ?? '%1.',
        start: Number(attr(child(level, 'start'), 'val') || 1),
      });
    }
    abstracts.set(attr(abstract, 'abstractNumId'), levels);
  }
  const numbering = new Map();
  for (const num of Array.from(doc.getElementsByTagNameNS(W, 'num'))) {
    numbering.set(attr(num, 'numId'), abstracts.get(attr(child(num, 'abstractNumId'), 'val')) || new Map());
  }
  return numbering;
}

function runText(paragraph) {
  let text = '';
  const walk = node => {
    for (const item of Array.from(node.childNodes || [])) {
      const name = item.localName;
      if (name === 't') text += item.textContent;
      else if (name === 'tab') text += '\t';
      else if (name === 'br' || name === 'cr') text += '\n';
      else if (name === 'drawing' || name === 'pict' || name === 'object') text += ' [picture] ';
      else if (name === 'oMath' || name === 'oMathPara') text += Array.from(item.getElementsByTagNameNS('http://schemas.openxmlformats.org/officeDocument/2006/math', 't')).map(node2 => node2.textContent).join('');
      else if (name !== 'pPr' && name !== 'rPr' && name !== 'instrText') walk(item);
    }
  };
  walk(paragraph);
  return text.replace(/[ \t]+$/g, '');
}

/** Plain text (with Markdown tables) of a .docx file. */
export async function docxToText(file) {
  const zip = await JSZip.loadAsync(file);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('This does not look like a Word (.docx) file.');
  const numbering = readNumbering(await zip.file('word/numbering.xml')?.async('string'));
  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const counters = new Map(); // numId → [count per level]
  const lines = [];

  const paragraphText = paragraph => {
    const props = child(paragraph, 'pPr');
    const numPr = child(props, 'numPr');
    let prefix = '';
    if (numPr) {
      const numId = attr(child(numPr, 'numId'), 'val');
      const ilvl = Number(attr(child(numPr, 'ilvl'), 'val') || 0);
      const levels = numbering.get(numId);
      if (numId && numId !== '0' && levels) {
        const counts = counters.get(numId) || [];
        for (let level = 0; level <= ilvl; level += 1) if (counts[level] === undefined) counts[level] = (levels.get(level)?.start || 1) - 1;
        counts[ilvl] += 1;
        counts.length = ilvl + 1; // deeper levels restart
        counters.set(numId, counts);
        const definition = levels.get(ilvl) || { format: 'decimal', text: '%1.' };
        prefix = definition.format === 'bullet' ? '' : definition.text.replace(/%(\d)/g, (_, n) => formatNumber(counts[Number(n) - 1] ?? 1, levels.get(Number(n) - 1)?.format || 'decimal'));
      }
    }
    const text = runText(paragraph);
    return prefix ? `${prefix} ${text.trim()}` : text;
  };

  for (const node of Array.from(body?.childNodes || [])) {
    if (node.localName === 'p') {
      lines.push(paragraphText(node));
    } else if (node.localName === 'tbl') {
      const rows = children(node, 'tr').map(row => children(row, 'tc').map(cell => children(cell, 'p').map(runText).join(' ').replace(/\|/g, '/').trim()));
      if (rows.length) {
        const width = Math.max(...rows.map(row => row.length));
        const pad = row => [...row, ...Array(width - row.length).fill('')];
        lines.push('', `| ${pad(rows[0]).join(' | ')} |`, `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(row => `| ${pad(row).join(' | ')} |`), '');
      }
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
