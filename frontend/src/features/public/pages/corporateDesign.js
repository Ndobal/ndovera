export const CORPORATE_DESIGNS = Object.freeze(['executive', 'future']);

export function resolveCorporateDesign(published, preview) {
  if (CORPORATE_DESIGNS.includes(preview)) return preview;
  return CORPORATE_DESIGNS.includes(published) ? published : 'executive';
}

export function publishCorporateDesignMetadata(existingMetadata, design) {
  if (!CORPORATE_DESIGNS.includes(design)) throw new Error('Invalid corporate design');
  const metadata = existingMetadata && typeof existingMetadata === 'object' && !Array.isArray(existingMetadata)
    ? existingMetadata : {};
  return { ...metadata, corporateDesign: design };
}
