import { useEffect, useMemo, useState } from 'react';
import { AudioLines, BookOpenText, FileText, ImageIcon, Layers3, Presentation, Video } from 'lucide-react';

import type { ClassroomCreatedDocument, ClassroomMaterialAsset, ClassroomMaterialViewerType, ClassroomNote } from '../services/classroomApi';

type ClassroomMaterialViewerProps = {
  note: ClassroomNote;
  compact?: boolean;
};

type ViewerItem = {
  id: string;
  label: string;
  viewerType: Exclude<ClassroomMaterialViewerType, 'mixed'>;
  asset?: ClassroomMaterialAsset;
  document?: ClassroomCreatedDocument;
};

function formatBytes(size: number | null | undefined) {
  if (!size || size <= 0) return 'Unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function prettifyViewerType(viewerType: ClassroomMaterialViewerType | undefined) {
  switch (viewerType) {
    case 'audio':
      return 'Audio';
    case 'video':
      return 'Video';
    case 'image':
      return 'Image';
    case 'pdf':
      return 'PDF';
    case 'document':
      return 'Document';
    case 'slides':
      return 'Slides';
    case 'ndovera-document':
      return 'Ndovera Doc';
    case 'mixed':
      return 'Mixed';
    default:
      return 'Material';
  }
}

function getViewerIcon(viewerType: ClassroomMaterialViewerType | undefined) {
  switch (viewerType) {
    case 'audio':
      return AudioLines;
    case 'video':
      return Video;
    case 'image':
      return ImageIcon;
    case 'slides':
      return Presentation;
    case 'ndovera-document':
      return BookOpenText;
    case 'mixed':
      return Layers3;
    default:
      return FileText;
  }
}

function buildFallbackDocument(note: ClassroomNote): ClassroomCreatedDocument {
  return {
    title: note.title,
    subtitle: `${note.subject} • ${note.topic}`,
    blocks: note.summary
      .split(/\n\s*\n/g)
      .map((part, index) => part.trim())
      .filter(Boolean)
      .map((part, index) => ({
        id: `fallback_${index}`,
        type: 'paragraph' as const,
        text: part,
      })),
  };
}

function buildViewerItems(note: ClassroomNote): ViewerItem[] {
  const items: ViewerItem[] = [];

  for (const asset of note.materials || []) {
    items.push({
      id: asset.id,
      label: asset.name,
      viewerType: asset.viewerType,
      asset,
    });
  }

  if (note.ndoveraDocument?.blocks?.length) {
    items.push({
      id: `${note.id}_ndovera`,
      label: note.ndoveraDocument.title || 'Ndovera Doc',
      viewerType: 'ndovera-document',
      document: note.ndoveraDocument,
    });
  }

  if (!items.length) {
    items.push({
      id: `${note.id}_fallback`,
      label: 'Study copy',
      viewerType: 'ndovera-document',
      document: buildFallbackDocument(note),
    });
  }

  return items;
}

function renderDocumentBlocks(document: ClassroomCreatedDocument) {
  return (
    <div className="space-y-4">
      {document.subtitle ? <p className="text-sm font-semibold text-slate-300">{document.subtitle}</p> : null}
      {document.blocks.map((block) => {
        if (block.type === 'bullet-list') {
          return (
            <ul key={block.id} className="list-disc space-y-2 pl-5 text-sm leading-7 text-slate-100">
              {(block.items || []).map((item, index) => <li key={`${block.id}_${index}`}>{item}</li>)}
            </ul>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={block.id} className="rounded-3xl border border-amber-300/30 bg-amber-500/10 px-4 py-4 text-sm italic leading-7 text-amber-100">
              {block.text}
            </blockquote>
          );
        }

        return <p key={block.id} className="text-sm leading-7 text-slate-100">{block.text}</p>;
      })}
    </div>
  );
}

export function ClassroomMaterialViewer({ note, compact = false }: ClassroomMaterialViewerProps) {
  const viewerItems = useMemo(() => buildViewerItems(note), [note]);
  const [activeViewerId, setActiveViewerId] = useState<string>(viewerItems[0]?.id || '');

  useEffect(() => {
    setActiveViewerId(viewerItems[0]?.id || '');
  }, [viewerItems]);

  const activeViewer = viewerItems.find((item) => item.id === activeViewerId) || viewerItems[0] || null;
  const ActiveIcon = getViewerIcon(activeViewer?.viewerType || note.viewerType);
  const frameHeightClass = compact ? 'h-[360px]' : 'h-[480px]';

  if (!activeViewer) return null;

  return (
    <section className="rounded-[2rem] border border-slate-700/80 bg-[#0a1833] p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              <ActiveIcon className="h-3.5 w-3.5" />
              {prettifyViewerType(activeViewer.viewerType)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">{viewerItems.length} in-app view{viewerItems.length === 1 ? '' : 's'}</span>
          </div>
          <h4 className="mt-3 text-lg font-bold text-white">{activeViewer.label}</h4>
          {activeViewer.asset ? (
            <p className="mt-2 text-xs font-medium text-slate-300">
              {activeViewer.asset.mimeType} • {formatBytes(activeViewer.asset.size)}
            </p>
          ) : null}
        </div>

        {viewerItems.length > 1 ? (
          <div className="flex max-w-full flex-wrap gap-2 xl:justify-end">
            {viewerItems.map((item) => {
              const ItemIcon = getViewerIcon(item.viewerType);
              const active = item.id === activeViewer.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveViewerId(item.id)}
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? 'border-slate-200 bg-white text-slate-950' : 'border-white/15 bg-white/10 text-slate-100'}`}
                >
                  <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-slate-700/80 bg-[#0f2144]">
        {activeViewer.viewerType === 'image' && activeViewer.asset?.url ? (
          <div className="flex items-center justify-center bg-slate-950/95 p-4">
            <img src={activeViewer.asset.url} alt={activeViewer.asset.name} className="max-h-[70vh] w-full rounded-[1.5rem] object-contain" />
          </div>
        ) : null}

        {activeViewer.viewerType === 'audio' && activeViewer.asset?.url ? (
          <div className="space-y-4 p-5">
            <div className="rounded-[1.5rem] bg-emerald-950 px-5 py-5 text-emerald-50">
              <p className="text-sm font-semibold">Audio stays inside Ndovera.</p>
              <p className="mt-2 text-sm text-emerald-100/85">Students can listen here without opening another app.</p>
            </div>
            <audio controls preload="metadata" src={activeViewer.asset.url} className="w-full" />
          </div>
        ) : null}

        {activeViewer.viewerType === 'video' && activeViewer.asset?.url ? (
          <div className="bg-slate-950 p-3">
            <video controls preload="metadata" src={activeViewer.asset.url} className="max-h-[72vh] w-full rounded-[1.5rem] bg-black object-contain" />
          </div>
        ) : null}

        {activeViewer.viewerType === 'pdf' && activeViewer.asset?.url ? (
          <iframe title={activeViewer.asset.name} src={activeViewer.asset.url} className={`w-full ${frameHeightClass} bg-white`} />
        ) : null}

        {(activeViewer.viewerType === 'document' || activeViewer.viewerType === 'slides') && activeViewer.asset?.url ? (
          <div className="space-y-4 p-4">
            <iframe title={activeViewer.asset.name} src={activeViewer.asset.url} className={`w-full rounded-[1.5rem] border border-slate-200 bg-white ${frameHeightClass}`} />
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/85 p-4 text-sm text-amber-900">
              <p className="font-semibold">This file is being kept inside the app.</p>
              <p className="mt-2 leading-7">If the browser cannot fully render this office format, the study copy below still keeps the lesson inside Ndovera.</p>
            </div>
            {renderDocumentBlocks(note.ndoveraDocument || buildFallbackDocument(note))}
          </div>
        ) : null}

        {activeViewer.viewerType === 'ndovera-document' && activeViewer.document ? (
          <div className="p-5">
            <div className="rounded-[1.75rem] border border-slate-700 bg-[#0a1833] px-5 py-5 shadow-sm">
              {renderDocumentBlocks(activeViewer.document)}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
