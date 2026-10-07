import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import './richContent.css';
import { renderRichText } from './richText';

/**
 * Academic text — headings, tables, formulas, lists, quotes — rendered the same
 * way everywhere in Ndovera. `inline` for a single line (a list item, a cell).
 */
export default function RichContent({ text, inline = false, className = '', as }) {
  const html = useMemo(() => renderRichText(text, { inline }), [text, inline]);
  const Tag = as || (inline ? 'span' : 'div');
  if (!html) return null;
  // The HTML comes from renderRichText, which sanitises with DOMPurify before
  // typesetting maths with KaTeX (trust disabled).
  return <Tag className={`ndv-rich ${inline ? 'ndv-rich-inline' : ''} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
