import React, { useMemo } from 'react';
import {
  ArchiveBoxIcon,
  DocumentTextIcon,
  FilmIcon,
  LinkIcon,
  MusicalNoteIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

const EXTENSION_KIND_MAP = {
  avi: 'video',
  csv: 'spreadsheet',
  doc: 'document',
  docx: 'document',
  gif: 'image',
  jpeg: 'image',
  jpg: 'image',
  mov: 'video',
  mp3: 'audio',
  mp4: 'video',
  pdf: 'pdf',
  png: 'image',
  ppt: 'presentation',
  pptx: 'presentation',
  rar: 'archive',
  txt: 'document',
  wav: 'audio',
  webm: 'video',
  webp: 'image',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  zip: 'archive',
};

const KIND_CONFIG = {
  archive: {
    icon: ArchiveBoxIcon,
    label: 'Archive',
    tileClassName: 'border-[#c9a96e]/50 bg-[#fff0d7] text-[#800000] dark:border-[#bf00ff]/35 dark:bg-[#3b003b]/55 dark:text-[#ffffff]',
    badgeClassName: 'bg-[#800000] text-[#b5e3f4] dark:bg-[#bf00ff] dark:text-[#000000]',
  },
  audio: {
    icon: MusicalNoteIcon,
    label: 'Audio',
    tileClassName: 'border-[#c9a96e]/50 bg-[#eef8f1] text-[#1a5c38] dark:border-[#00ffff]/35 dark:bg-[#00363a]/55 dark:text-[#00ffff]',
    badgeClassName: 'bg-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]',
  },
  document: {
    icon: DocumentTextIcon,
    label: 'Document',
    tileClassName: 'border-[#c9a96e]/50 bg-[#fff8f0] text-[#191970] dark:border-[#bf00ff]/35 dark:bg-[#1d0a2e]/55 dark:text-[#39ff14]',
    badgeClassName: 'bg-[#191970] text-[#b5e3f4] dark:bg-[#39ff14] dark:text-[#000000]',
  },
  image: {
    icon: PhotoIcon,
    label: 'Image',
    tileClassName: 'border-[#c9a96e]/50 bg-[#fff1ef] text-[#800020] dark:border-[#ff5f8d]/35 dark:bg-[#3b001f]/55 dark:text-[#ffffff]',
    badgeClassName: 'bg-[#800020] text-[#b5e3f4] dark:bg-[#ff5f8d] dark:text-[#000000]',
  },
  link: {
    icon: LinkIcon,
    label: 'Link',
    tileClassName: 'border-[#c9a96e]/50 bg-[#eef2ff] text-[#191970] dark:border-[#00ffff]/35 dark:bg-[#001f4f]/55 dark:text-[#00ffff]',
    badgeClassName: 'bg-[#191970] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]',
  },
  pdf: {
    icon: DocumentTextIcon,
    label: 'PDF',
    tileClassName: 'border-[#c9a96e]/50 bg-[#ffe9e5] text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#410014]/55 dark:text-[#ffffff]',
    badgeClassName: 'bg-[#800000] text-[#b5e3f4] dark:bg-[#ff5f8d] dark:text-[#000000]',
  },
  presentation: {
    icon: PresentationChartBarIcon,
    label: 'Slides',
    tileClassName: 'border-[#c9a96e]/50 bg-[#fff6de] text-[#800000] dark:border-[#bf00ff]/35 dark:bg-[#2f103f]/55 dark:text-[#ffffff]',
    badgeClassName: 'bg-[#800000] text-[#b5e3f4] dark:bg-[#bf00ff] dark:text-[#000000]',
  },
  spreadsheet: {
    icon: TableCellsIcon,
    label: 'Sheet',
    tileClassName: 'border-[#c9a96e]/50 bg-[#ecf7ee] text-[#1a5c38] dark:border-[#39ff14]/35 dark:bg-[#003b17]/55 dark:text-[#39ff14]',
    badgeClassName: 'bg-[#1a5c38] text-[#b5e3f4] dark:bg-[#39ff14] dark:text-[#000000]',
  },
  video: {
    icon: FilmIcon,
    label: 'Video',
    tileClassName: 'border-[#c9a96e]/50 bg-[#f0edff] text-[#191970] dark:border-[#00ffff]/35 dark:bg-[#16164d]/55 dark:text-[#00ffff]',
    badgeClassName: 'bg-[#191970] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]',
  },
};

function firstNonEmpty(values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || '';
}

function getFileExtension(material) {
  const candidate = firstNonEmpty([
    material?.metadata?.fileName,
    material?.metadata?.originalName,
    material?.url,
    material?.title,
  ]);

  if (!candidate) return '';
  const match = candidate.match(/\.([a-z0-9]{1,8})(?:$|[?#])/i);
  return match ? match[1].toLowerCase() : '';
}

function getMaterialKind(material) {
  const explicitType = String(material?.type || '').trim().toLowerCase();
  if (explicitType === 'link') return 'link';
  if (explicitType === 'image') return 'image';
  if (explicitType === 'video') return 'video';

  const contentType = String(material?.metadata?.contentType || '').trim().toLowerCase();
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.includes('pdf')) return 'pdf';

  const extension = getFileExtension(material);
  return EXTENSION_KIND_MAP[extension] || (material?.url ? 'document' : 'link');
}

function getThumbnailBadge(material, kind) {
  const extension = getFileExtension(material);
  if (extension) return extension.toUpperCase();
  return KIND_CONFIG[kind]?.label.toUpperCase() || 'FILE';
}

export function materialTypeLabel(material) {
  const kind = getMaterialKind(material);
  return KIND_CONFIG[kind]?.label || 'Document';
}

export default function MaterialTypeThumbnail({ material, className = '' }) {
  const { Icon, label, tileClassName, badgeClassName } = useMemo(() => {
    const kind = getMaterialKind(material);
    const config = KIND_CONFIG[kind] || KIND_CONFIG.document;
    return {
      Icon: config.icon,
      label: config.label,
      tileClassName: config.tileClassName,
      badgeClassName: config.badgeClassName,
      badgeText: getThumbnailBadge(material, kind),
    };
  }, [material]);

  const badgeText = useMemo(() => getThumbnailBadge(material, getMaterialKind(material)), [material]);

  return (
    <div className={`relative flex h-24 w-24 shrink-0 flex-col justify-between overflow-hidden rounded-[1.5rem] border p-3 ${tileClassName} ${className}`.trim()}>
      <span className="text-[10px] font-black uppercase tracking-[0.22em] opacity-80">{label}</span>
      <Icon className="h-10 w-10 self-center" />
      <span className={`self-start rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeClassName}`}>{badgeText}</span>
    </div>
  );
}