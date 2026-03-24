/* cspell:words Ndovera CRDT ydoc hilite */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Code,
  Download,
  FastForward,
  FileImage,
  FileText,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Quote,
  Save,
  Share2,
  Smile,
  Sparkles,
  Square,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Volume2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph } from 'docx';
import { saveAs } from 'file-saver';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { NdoveraEmojiPicker } from './EmojiPicker';
import { ShapeCanvas } from './ShapeCanvas';

const DOCS_WS_URL = (import.meta as any)?.env?.VITE_NDOVERA_DOCS_WS_URL || '';
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_GAP = 40;
const HEADER_SPACE = 78;
const FOOTER_SPACE = 72;
const ESTIMATED_CHARS_PER_PAGE = 2200;

type SidebarTab = 'pages' | 'stats' | 'style' | 'images';
type WriterTab = 'ai' | 'characters' | 'structure' | 'notes';
type MenuKey = 'file' | 'edit' | 'insert' | 'format' | 'tools' | 'novel-tools' | null;

type ThemePreset = {
  id: string;
  name: string;
  accent: string;
  canvas: string;
  page: string;
  ink: string;
  chrome: string;
};

type ManagedImage = {
  id: string;
  name: string;
  src: string;
  processedSrc: string;
  threshold: number;
  background: string;
  removeBackground: boolean;
};

const THEME_PRESETS: ThemePreset[] = [
  { id: 'classic', name: 'Classic Blue', accent: '#2563eb', canvas: '#dbeafe', page: '#ffffff', ink: '#0f172a', chrome: '#eff6ff' },
  { id: 'forest', name: 'Forest Ink', accent: '#15803d', canvas: '#dcfce7', page: '#fdfdfb', ink: '#14532d', chrome: '#f0fdf4' },
  { id: 'rose', name: 'Rose Paper', accent: '#e11d48', canvas: '#ffe4e6', page: '#fffafc', ink: '#4c0519', chrome: '#fff1f2' },
  { id: 'night', name: 'Night Studio', accent: '#8b5cf6', canvas: '#0f172a', page: '#111827', ink: '#f8fafc', chrome: '#1e293b' },
];

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wordsFromText(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function dataUrlFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function processImageSource(src: string, threshold: number, removeBackground: boolean, background: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available'));
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = img.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        const distance = Math.max(Math.abs(r - 255), Math.abs(g - 255), Math.abs(b - 255));
        const shouldRemove = removeBackground && (brightness >= threshold || distance < 18);
        if (shouldRemove) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(img, 0, 0);

      if (background && background !== 'transparent') {
        const output = document.createElement('canvas');
        output.width = image.width;
        output.height = image.height;
        const octx = output.getContext('2d');
        if (!octx) {
          reject(new Error('Canvas not available'));
          return;
        }
        octx.fillStyle = background;
        octx.fillRect(0, 0, output.width, output.height);
        octx.drawImage(canvas, 0, 0);
        resolve(output.toDataURL('image/png'));
        return;
      }

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Unable to load image'));
    image.src = src;
  });
}

export interface NdoveraDocsCreatorProps {
  onClose: () => void;
  initialTitle?: string;
  initialContent?: string;
  onSave?: (payload: { title: string; content: string }) => void | Promise<void>;
}

export const NdoveraDocsCreator: React.FC<NdoveraDocsCreatorProps> = ({
  onClose,
  initialTitle = 'Untitled Document',
  initialContent = '',
  onSave,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [leftSidebarTab, setLeftSidebarTab] = useState<SidebarTab>('pages');
  const [activeWriterTab, setActiveWriterTab] = useState<WriterTab>('ai');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isShapeMode, setIsShapeMode] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [collaborationStatus, setCollaborationStatus] = useState<'local' | 'connecting' | 'connected' | 'offline'>(DOCS_WS_URL ? 'connecting' : 'local');
  const [theme, setTheme] = useState<ThemePreset>(THEME_PRESETS[0]);
  const [zoom, setZoom] = useState(1);
  const [headerEnabled, setHeaderEnabled] = useState(true);
  const [headerText, setHeaderText] = useState(initialTitle);
  const [footerEnabled, setFooterEnabled] = useState(true);
  const [footerText, setFooterText] = useState('Confidential draft');
  const [autoPageNumbers, setAutoPageNumbers] = useState(true);
  const [managedImages, setManagedImages] = useState<ManagedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedPage, setSelectedPage] = useState(1);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const ydoc = useRef(DOCS_WS_URL ? new Y.Doc() : null).current;
  const provider = useRef(
    DOCS_WS_URL && ydoc ? new WebsocketProvider(DOCS_WS_URL, `ndovera-doc-${initialTitle.replace(/\s+/g, '-').toLowerCase() || 'workspace'}`, ydoc) : null,
  ).current;
  const currentUser = useRef({
    name: `Author_${Math.floor(Math.random() * 1000)}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
  }).current;

  useEffect(() => {
    if (!provider || !ydoc) {
      setCollaborators([]);
      setCollaborationStatus('local');
      return;
    }

    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().values());
      const users = states.map((state: any) => state.user).filter(Boolean);
      setCollaborators(users);
    };

    const handleStatus = ({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) => {
      if (status === 'connected') setCollaborationStatus('connected');
      if (status === 'connecting') setCollaborationStatus('connecting');
      if (status === 'disconnected') setCollaborationStatus('offline');
    };

    provider.awareness.on('change', handleAwarenessChange);
    provider.on('status', handleStatus);

    return () => {
      provider.awareness.off('change', handleAwarenessChange);
      provider.off('status', handleStatus);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: !ydoc } as any),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ...(ydoc ? [Collaboration.configure({ document: ydoc })] : []),
      ...(provider ? [CollaborationCursor.configure({ provider, user: currentUser })] : []),
    ],
    content: ydoc ? undefined : initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      setContent(nextEditor.getHTML());
    },
  });

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      if (voices.length) setAvailableVoices(voices);
    };
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (content || title) setLastSaved(new Date());
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [content, title]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, []);

  useEffect(() => {
    if (!headerText || headerText === initialTitle || headerText === title) {
      setHeaderText(title || 'Untitled Document');
    }
  }, [headerText, initialTitle, title]);

  const plainText = useMemo(() => editor?.getText() || stripHtml(content), [content, editor]);
  const wordCount = useMemo(() => wordsFromText(plainText), [plainText]);
  const characterCount = useMemo(() => plainText.length, [plainText]);
  const estimatedPageCount = useMemo(() => {
    const imageWeight = managedImages.length * 350;
    const structuralWeight = Math.max(0, content.length - plainText.length) * 0.2;
    return Math.max(1, Math.ceil((characterCount + imageWeight + structuralWeight) / ESTIMATED_CHARS_PER_PAGE));
  }, [characterCount, content.length, managedImages.length, plainText.length]);
  const pageNumbers = useMemo(() => Array.from({ length: estimatedPageCount }, (_, index) => index + 1), [estimatedPageCount]);

  const documentWidth = useMemo(() => estimatedPageCount * PAGE_WIDTH + (estimatedPageCount - 1) * PAGE_GAP, [estimatedPageCount]);
  const zoomedWidth = documentWidth * zoom;
  const zoomedHeight = PAGE_HEIGHT * zoom;

  const scrollToPage = (page: number) => {
    const target = clamp(page, 1, estimatedPageCount);
    setSelectedPage(target);
    const container = canvasScrollRef.current;
    if (!container) return;
    container.scrollTo({ left: (target - 1) * (PAGE_WIDTH + PAGE_GAP) * zoom, behavior: 'smooth' });
  };

  const handleCanvasScroll = () => {
    const container = canvasScrollRef.current;
    if (!container) return;
    const page = Math.round(container.scrollLeft / ((PAGE_WIDTH + PAGE_GAP) * zoom)) + 1;
    setSelectedPage(clamp(page, 1, estimatedPageCount));
  };

  const runFormat = (command: string, value?: string) => {
    if (!editor) return;
    switch (command) {
      case 'bold': editor.chain().focus().toggleBold().run(); break;
      case 'italic': editor.chain().focus().toggleItalic().run(); break;
      case 'underline': editor.chain().focus().toggleUnderline().run(); break;
      case 'strike': editor.chain().focus().toggleStrike().run(); break;
      case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
      case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
      case 'ordered': editor.chain().focus().toggleOrderedList().run(); break;
      case 'left': (editor.chain().focus() as any).setTextAlign('left').run(); break;
      case 'center': (editor.chain().focus() as any).setTextAlign('center').run(); break;
      case 'right': (editor.chain().focus() as any).setTextAlign('right').run(); break;
      case 'justify': (editor.chain().focus() as any).setTextAlign('justify').run(); break;
      case 'textColor': if (value) wrapSelectionWithStyle(`color:${value};`); break;
      case 'highlight': if (value) wrapSelectionWithStyle(`background:${value}; padding:0 0.1em; border-radius:0.2em;`); break;
      case 'undo': editor.chain().focus().undo().run(); break;
      case 'redo': editor.chain().focus().redo().run(); break;
      case 'clear': editor.chain().focus().unsetAllMarks().clearNodes().run(); break;
      case 'link': {
        const url = window.prompt('Enter link URL', 'https://');
        if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        break;
      }
      default: break;
    }
  };

  const wrapSelectionWithStyle = (style: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;
    editor.chain().focus().insertContentAt({ from, to }, `<span style="${style}">${selectedText}</span>`).run();
  };

  const insertTable = () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.resolve(onSave?.({ title, content: editor?.getHTML() || content }));
    } finally {
      window.setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 700);
    }
  };

  const exportDOCX = () => {
    const doc = new Document({ sections: [{ children: [new Paragraph(editor?.getText() || plainText || '')] }] });
    Packer.toBlob(doc).then((blob) => saveAs(blob, `${title || 'document'}.docx`));
  };

  const exportPDF = async () => {
    const element = document.querySelector('.ndovera-doc-canvas') as HTMLElement | null;
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: theme.canvas });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', [canvas.width / 4, canvas.height / 4]);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(img, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${title || 'document'}.pdf`);
  };

  const toggleTTS = () => {
    if (!synthRef.current) return;
    if (isPlaying) {
      synthRef.current.cancel();
      setIsPlaying(false);
      return;
    }
    const textToRead = editor?.getText() || plainText;
    if (!textToRead.trim()) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = playbackSpeed;
    if (availableVoices[selectedVoiceIndex]) utterance.voice = availableVoices[selectedVoiceIndex];
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    synthRef.current.speak(utterance);
    setIsPlaying(true);
  };

  const stopTTS = () => {
    synthRef.current?.cancel();
    setIsPlaying(false);
  };

  const cycleSpeed = () => {
    const next = playbackSpeed === 1 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(next);
    if (isPlaying) {
      stopTTS();
      window.setTimeout(toggleTTS, 100);
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const created = await Promise.all(
      Array.from(files).map(async (file) => {
        const src = await dataUrlFromFile(file);
        return {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          src,
          processedSrc: src,
          threshold: 232,
          background: '#ffffff',
          removeBackground: false,
        } as ManagedImage;
      }),
    );
    setManagedImages((current) => [...created, ...current]);
    setLeftSidebarTab('images');
  };

  const insertCurrentDateTime = () => {
    editor?.chain().focus().insertContent(`<p>${new Date().toLocaleString()}</p>`).run();
    setActiveMenu(null);
  };

  const insertDivider = () => {
    editor?.chain().focus().insertContent('<hr /><p></p>').run();
    setActiveMenu(null);
  };

  const insertPageReference = () => {
    editor?.chain().focus().insertContent(`<span style="font-weight:600; color:${theme.accent};">Page ${selectedPage}</span>`).run();
    setActiveMenu(null);
  };

  const updateManagedImage = async (imageId: string, updates: Partial<ManagedImage>) => {
    const existing = managedImages.find((item) => item.id === imageId);
    if (!existing) return;
    const next = { ...existing, ...updates };
    const processedSrc = await processImageSource(next.src, next.threshold, next.removeBackground, next.background);
    setManagedImages((current) => current.map((item) => (item.id === imageId ? { ...next, processedSrc } : item)));
  };

  const insertImage = (src: string) => {
    editor?.chain().focus().insertContent(`<img src="${src}" alt="Inserted asset" />`).run();
    setActiveMenu(null);
  };

  const menuItems = [
    { key: 'file' as const, label: 'File' },
    { key: 'edit' as const, label: 'Edit' },
    { key: 'insert' as const, label: 'Insert' },
    { key: 'format' as const, label: 'Format' },
    { key: 'tools' as const, label: 'Tools' },
    { key: 'novel-tools' as const, label: 'Novel Tools' },
  ];

  const renderMenuPanel = () => {
    if (!activeMenu) return null;

    const actionButton = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-800';

    return (
      <div className="absolute left-0 top-full z-40 mt-2 w-88 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950" ref={menuRef}>
        {activeMenu === 'file' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={handleSave} className={actionButton}>Save now</button>
            <button onClick={exportDOCX} className={actionButton}>Download DOCX</button>
            <button onClick={exportPDF} className={actionButton}>Download PDF</button>
            <button onClick={() => setIsShareModalOpen(true)} className={actionButton}>Share workspace</button>
          </div>
        ) : null}
        {activeMenu === 'edit' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => runFormat('undo')} className={actionButton}>Undo</button>
            <button onClick={() => runFormat('redo')} className={actionButton}>Redo</button>
            <button onClick={() => editor?.chain().focus().selectAll().run()} className={actionButton}>Select all</button>
            <button onClick={() => runFormat('clear')} className={actionButton}>Clear formatting</button>
          </div>
        ) : null}
        {activeMenu === 'insert' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={insertTable} className={actionButton}>Insert table</button>
            <button onClick={() => setShowEmojiPicker((current) => !current)} className={actionButton}>Insert emoji</button>
            <label className={`${actionButton} cursor-pointer`}>
              Insert image
              <input type="file" accept="image/*" className="hidden" multiple onChange={(event) => void addImages(event.target.files)} />
            </label>
            <button onClick={() => runFormat('link')} className={actionButton}>Insert link</button>
            <button onClick={insertCurrentDateTime} className={actionButton}>Insert date & time</button>
            <button onClick={insertPageReference} className={actionButton}>Insert page reference</button>
            <button onClick={insertDivider} className={actionButton}>Insert divider</button>
          </div>
        ) : null}
        {activeMenu === 'format' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => runFormat('h1')} className={actionButton}>H1</button>
              <button onClick={() => runFormat('h2')} className={actionButton}>H2</button>
              <button onClick={() => runFormat('quote')} className={actionButton}>Quote</button>
              <button onClick={() => runFormat('code')} className={actionButton}>Code</button>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                Text color
                <input type="color" defaultValue={theme.accent} onChange={(event) => runFormat('textColor', event.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                Highlight
                <input type="color" defaultValue="#fef08a" onChange={(event) => runFormat('highlight', event.target.value)} />
              </label>
            </div>
          </div>
        ) : null}
        {activeMenu === 'tools' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={toggleTTS} className={actionButton}>{isPlaying ? 'Pause reader' : 'Read aloud'}</button>
            <button onClick={cycleSpeed} className={actionButton}>Reader speed: {playbackSpeed}x</button>
            <button onClick={() => setZoom(1)} className={actionButton}>Reset zoom</button>
            <button onClick={() => scrollToPage(estimatedPageCount)} className={actionButton}>Go to last page</button>
          </div>
        ) : null}
        {activeMenu === 'novel-tools' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setIsRightSidebarOpen((current) => !current)} className={actionButton}>{isRightSidebarOpen ? 'Hide writer tools' : 'Show writer tools'}</button>
            <button onClick={() => setIsShapeMode((current) => !current)} className={actionButton}>{isShapeMode ? 'Exit draw mode' : 'Enter draw mode'}</button>
            <button onClick={() => setLeftSidebarTab('style')} className={actionButton}>Open page settings</button>
            <button onClick={() => setLeftSidebarTab('images')} className={actionButton}>Open image manager</button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-100 flex bg-slate-100 dark:bg-slate-950" style={{ color: theme.ink }}>
      <style>{`
        .ndovera-doc-canvas::-webkit-scrollbar,
        .ndovera-doc-left::-webkit-scrollbar,
        .ndovera-doc-right::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .ndovera-doc-canvas::-webkit-scrollbar-thumb,
        .ndovera-doc-left::-webkit-scrollbar-thumb,
        .ndovera-doc-right::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.45);
          border-radius: 999px;
        }
        .ndovera-doc-rich .ProseMirror {
          min-height: ${PAGE_HEIGHT - HEADER_SPACE - FOOTER_SPACE}px;
          height: 100%;
          column-count: ${estimatedPageCount};
          column-gap: ${PAGE_GAP}px;
          column-fill: auto;
          outline: none;
          color: ${theme.ink};
        }
        .ndovera-doc-rich .ProseMirror > * {
          break-inside: avoid;
        }
        .ndovera-doc-rich .ProseMirror p {
          margin: 0 0 0.9rem;
          line-height: 1.7;
        }
        .ndovera-doc-rich .ProseMirror h1,
        .ndovera-doc-rich .ProseMirror h2,
        .ndovera-doc-rich .ProseMirror h3 {
          break-after: avoid;
          color: ${theme.ink};
        }
        .ndovera-doc-rich .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
          overflow: hidden;
          margin: 1rem 0;
        }
        .ndovera-doc-rich .ProseMirror th,
        .ndovera-doc-rich .ProseMirror td {
          border: 1px solid rgba(148, 163, 184, 0.45);
          padding: 0.55rem 0.65rem;
          vertical-align: top;
        }
        .ndovera-doc-rich .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 14px;
          margin: 1rem 0;
        }
      `}</style>

      <aside className="ndovera-doc-left flex w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800" style={{ backgroundColor: theme.chrome }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: theme.accent }}>
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Document Maker</p>
              <p className="text-sm font-semibold">Paged workspace</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 border-b border-slate-200 p-2 dark:border-slate-800">
          {([
            { id: 'pages', label: 'Pages' },
            { id: 'stats', label: 'Stats' },
            { id: 'style', label: 'Style' },
            { id: 'images', label: 'Images' },
          ] as Array<{ id: SidebarTab; label: string }>).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLeftSidebarTab(tab.id)}
              className={`rounded-xl px-2 py-2 text-xs font-semibold ${leftSidebarTab === tab.id ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
              style={leftSidebarTab === tab.id ? { backgroundColor: theme.accent } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 p-4">
          {leftSidebarTab === 'pages' ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Page flow</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Pages are added automatically as the document grows. The canvas keeps sidebars fixed while the document scrolls horizontally and vertically.</p>
              </div>
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  onClick={() => scrollToPage(page)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${selectedPage === page ? 'text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}
                  style={selectedPage === page ? { backgroundColor: theme.accent, borderColor: theme.accent } : undefined}
                >
                  <span className="text-sm font-semibold">Page {page}</span>
                  <span className="text-xs opacity-80">{page === 1 ? 'Start' : page === estimatedPageCount ? 'Latest' : 'Continue'}</span>
                </button>
              ))}
            </div>
          ) : null}

          {leftSidebarTab === 'stats' ? (
            <div className="space-y-3">
              {[
                ['Words', wordCount],
                ['Characters', characterCount],
                ['Pages', estimatedPageCount],
                ['Zoom', `${Math.round(zoom * 100)}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Autosave</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{lastSaved ? `Last autosave ${lastSaved.toLocaleTimeString()}` : 'Waiting for the first autosave...'}</p>
              </div>
            </div>
          ) : null}

          {leftSidebarTab === 'style' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Header & footer</p>
                <div className="mt-3 space-y-3">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Show header</span>
                    <input type="checkbox" checked={headerEnabled} onChange={(event) => setHeaderEnabled(event.target.checked)} />
                  </label>
                  <input value={headerText} onChange={(event) => setHeaderText(event.target.value)} placeholder="Header text" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Show footer</span>
                    <input type="checkbox" checked={footerEnabled} onChange={(event) => setFooterEnabled(event.target.checked)} />
                  </label>
                  <input value={footerText} onChange={(event) => setFooterText(event.target.value)} placeholder="Footer text" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950" />
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Automatic page numbers</span>
                    <input type="checkbox" checked={autoPageNumbers} onChange={(event) => setAutoPageNumbers(event.target.checked)} />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Theme colours</p>
                <div className="mt-3 space-y-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setTheme(preset)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${theme.id === preset.id ? 'border-transparent text-white' : 'border-slate-200 dark:border-slate-700'}`}
                      style={theme.id === preset.id ? { backgroundColor: preset.accent } : undefined}
                    >
                      <span className="h-6 w-6 rounded-full border border-white/40" style={{ backgroundColor: preset.accent }} />
                      <span className="text-sm font-semibold">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Zoom</p>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => setZoom((current) => clamp(Number((current - 0.1).toFixed(2)), 0.6, 2))} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"><ZoomOut className="h-4 w-4" /></button>
                  <input type="range" min="0.6" max="2" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1" />
                  <button onClick={() => setZoom((current) => clamp(Number((current + 0.1).toFixed(2)), 0.6, 2))} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"><ZoomIn className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ) : null}

          {leftSidebarTab === 'images' ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300">
                <FileImage className="h-4 w-4" />
                Add images
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addImages(event.target.files)} />
              </label>
              {managedImages.map((image) => (
                <div key={image.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <img src={image.processedSrc} alt={image.name} className="h-28 w-full rounded-xl object-cover" />
                  <p className="mt-3 truncate text-sm font-semibold">{image.name}</p>
                  <div className="mt-3 space-y-2">
                    <button onClick={() => void updateManagedImage(image.id, { removeBackground: true })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">AI remove background</button>
                    <label className="block text-xs text-slate-500">
                      Manual threshold {image.threshold}
                      <input type="range" min="180" max="250" step="1" value={image.threshold} onChange={(event) => void updateManagedImage(image.id, { threshold: Number(event.target.value), removeBackground: true })} className="mt-1 w-full" />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      Background colour
                      <input type="color" value={image.background} onChange={(event) => void updateManagedImage(image.id, { background: event.target.value })} />
                    </label>
                    <button onClick={() => insertImage(image.processedSrc)} className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: theme.accent }}>Insert into page</button>
                  </div>
                </div>
              ))}
              {!managedImages.length ? <p className="text-sm text-slate-500">No images added yet.</p> : null}
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="bg-transparent text-xl font-bold outline-none" placeholder="Untitled Document" />
                <div className={`rounded-xl px-3 py-1 text-[11px] font-semibold ${collaborationStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-500' : collaborationStatus === 'connecting' ? 'bg-blue-500/10 text-blue-500' : collaborationStatus === 'offline' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {collaborationStatus === 'connected' ? 'Collaboration live' : collaborationStatus === 'connecting' ? 'Connecting collaboration' : collaborationStatus === 'offline' ? 'Collaboration offline' : 'Local editing'}
                </div>
              </div>
              <div className="relative mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {menuItems.map((item) => (
                  <button key={item.key} onClick={() => setActiveMenu((current) => current === item.key ? null : item.key)} className="rounded-lg px-2 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                    {item.label}
                  </button>
                ))}
                {isSaving ? (
                  <span className="flex items-center gap-1 text-blue-500"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>
                ) : lastSaved ? (
                  <span>Autosaved at {lastSaved.toLocaleTimeString()}</span>
                ) : null}
                {renderMenuPanel()}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {collaborators.length > 0 ? (
                <div className="flex -space-x-2 pr-2">
                  {collaborators.map((c, index) => (
                    <div key={`${c.name}_${index}`} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white dark:border-slate-950" style={{ backgroundColor: c.color }} title={c.name}>
                      {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  ))}
                </div>
              ) : null}
              <button onClick={exportDOCX} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><Download className="h-4 w-4" /> DOCX</button>
              <button onClick={exportPDF} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><Download className="h-4 w-4" /> PDF</button>
              <button onClick={() => setIsShareModalOpen(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><Share2 className="h-4 w-4" /> Share</button>
              <button onClick={handleSave} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: theme.accent }}><Save className="h-4 w-4" /> Save</button>
              <button onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1">
              <button onClick={() => runFormat('bold')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Bold className="h-4 w-4" /></button>
              <button onClick={() => runFormat('italic')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Italic className="h-4 w-4" /></button>
              <button onClick={() => runFormat('underline')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><UnderlineIcon className="h-4 w-4" /></button>
              <button onClick={() => runFormat('strike')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Strikethrough className="h-4 w-4" /></button>
              <button onClick={() => runFormat('h1')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Heading1 className="h-4 w-4" /></button>
              <button onClick={() => runFormat('h2')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Heading2 className="h-4 w-4" /></button>
              <button onClick={() => runFormat('quote')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Quote className="h-4 w-4" /></button>
              <button onClick={() => runFormat('code')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Code className="h-4 w-4" /></button>
              <button onClick={() => runFormat('bullet')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><List className="h-4 w-4" /></button>
              <button onClick={() => runFormat('ordered')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ListOrdered className="h-4 w-4" /></button>
              <button onClick={() => runFormat('left')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><AlignLeft className="h-4 w-4" /></button>
              <button onClick={() => runFormat('center')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><AlignCenter className="h-4 w-4" /></button>
              <button onClick={() => runFormat('right')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><AlignRight className="h-4 w-4" /></button>
              <button onClick={() => runFormat('justify')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><AlignJustify className="h-4 w-4" /></button>
              <button onClick={insertTable} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><TableIcon className="h-4 w-4" /></button>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert image">
                <FileImage className="h-4 w-4" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void addImages(event.target.files)} />
              </label>
              <button onClick={insertCurrentDateTime} className="rounded-lg px-2 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert date and time">Date</button>
              <button onClick={insertPageReference} className="rounded-lg px-2 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert current page reference">Pg#</button>
              <button onClick={insertDivider} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Insert divider"><Minus className="h-4 w-4" /></button>
              <button onClick={() => setShowEmojiPicker((current) => !current)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><Smile className="h-4 w-4" /></button>
              <button onClick={() => runFormat('link')} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><LinkIcon className="h-4 w-4" /></button>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Baseline className="h-4 w-4" />
                <input type="color" className="h-5 w-5 cursor-pointer border-0 p-0" defaultValue={theme.accent} onChange={(event) => runFormat('textColor', event.target.value)} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Highlighter className="h-4 w-4" />
                <input type="color" className="h-5 w-5 cursor-pointer border-0 p-0" defaultValue="#fef08a" onChange={(event) => runFormat('highlight', event.target.value)} />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1 dark:border-slate-700">
                <button onClick={() => setZoom((current) => clamp(Number((current - 0.1).toFixed(2)), 0.6, 2))}><Minus className="h-4 w-4" /></button>
                <span className="min-w-14 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((current) => clamp(Number((current + 0.1).toFixed(2)), 0.6, 2))}><Plus className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1 dark:border-slate-700">
                <Volume2 className="h-4 w-4" />
                <button onClick={toggleTTS}>{isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button onClick={stopTTS}><Square className="h-4 w-4" /></button>
                <button onClick={cycleSpeed} className="flex items-center gap-1 text-xs font-semibold"><FastForward className="h-3.5 w-3.5" /> {playbackSpeed}x</button>
                <select value={selectedVoiceIndex} onChange={(event) => setSelectedVoiceIndex(Number(event.target.value))} className="max-w-40 bg-transparent text-xs outline-none">
                  {availableVoices.length ? availableVoices.map((voice, index) => <option key={voice.name} value={index}>{voice.name}</option>) : <option value={0}>System voice</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {showEmojiPicker ? (
            <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2">
              <NdoveraEmojiPicker onClose={() => setShowEmojiPicker(false)} onEmojiSelect={(emoji) => editor?.chain().focus().insertContent(emoji.native).run()} />
            </div>
          ) : null}

          <div ref={canvasScrollRef} onScroll={handleCanvasScroll} className="ndovera-doc-canvas flex-1 overflow-auto" style={{ backgroundColor: theme.canvas }}>
            <div className="p-8">
              <div style={{ width: zoomedWidth, height: zoomedHeight, minHeight: zoomedHeight }}>
                <div className="relative" style={{ width: documentWidth, height: PAGE_HEIGHT, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                  <div className="absolute inset-0 flex gap-10">
                    {pageNumbers.map((page) => (
                      <div key={page} className="relative shrink-0 overflow-hidden rounded-[28px] border shadow-2xl" style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, backgroundColor: theme.page, borderColor: `${theme.accent}25`, boxShadow: theme.id === 'night' ? '0 30px 80px rgba(15, 23, 42, 0.55)' : '0 30px 80px rgba(15, 23, 42, 0.12)' }}>
                        {headerEnabled ? (
                          <div className="absolute inset-x-0 top-0 z-10 flex h-17.5 items-center justify-between border-b px-10 text-xs font-semibold uppercase tracking-[0.22em]" style={{ borderColor: `${theme.accent}20`, background: `linear-gradient(180deg, ${theme.chrome}, transparent)` }}>
                            <span className="truncate">{headerText || title}</span>
                            <span>Page {page}</span>
                          </div>
                        ) : null}
                        {footerEnabled ? (
                          <div className="absolute inset-x-0 bottom-0 z-10 flex h-16 items-center justify-between border-t px-10 text-xs" style={{ borderColor: `${theme.accent}20`, background: `linear-gradient(0deg, ${theme.chrome}, transparent)` }}>
                            <span className="truncate">{footerText || 'Document workspace'}</span>
                            <span>{autoPageNumbers ? `${page}` : ''}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="ndovera-doc-rich absolute inset-0" style={{ width: documentWidth, height: PAGE_HEIGHT, paddingTop: HEADER_SPACE, paddingBottom: FOOTER_SPACE }}>
                    <div className="h-full px-18">
                      <EditorContent editor={editor} className={`${isShapeMode ? 'pointer-events-none select-none opacity-80' : ''}`} />
                    </div>
                    {isShapeMode ? <ShapeCanvas /> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isRightSidebarOpen ? (
            <aside className="ndovera-doc-right flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                  <Wand2 className="h-4 w-4" style={{ color: theme.accent }} />
                  Writer tools
                </h3>
                <button onClick={() => setIsRightSidebarOpen(false)} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex border-b border-slate-200 px-2 pt-2 dark:border-slate-800">
                {([
                  ['ai', 'AI Assist'],
                  ['characters', 'Cast'],
                  ['structure', 'Outline'],
                  ['notes', 'Notes'],
                ] as Array<[WriterTab, string]>).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveWriterTab(tab)} className={`rounded-t-xl px-3 py-2 text-sm font-semibold ${activeWriterTab === tab ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} style={activeWriterTab === tab ? { backgroundColor: theme.accent } : undefined}>{label}</button>
                ))}
              </div>

              <div className="flex-1 space-y-4 p-4">
                {activeWriterTab === 'ai' ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border p-4" style={{ borderColor: `${theme.accent}33`, backgroundColor: theme.chrome }}>
                      <p className="text-sm font-semibold">Quick actions</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => setIsGenerating((current) => !current)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">{isGenerating ? 'Thinking…' : 'Generate ideas'}</button>
                        <button onClick={() => runFormat('clear')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Reset formatting</button>
                        <button onClick={() => runFormat('quote')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Turn to quote</button>
                        <button onClick={() => scrollToPage(estimatedPageCount)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900">Jump to end</button>
                      </div>
                    </div>
                    <textarea className="h-32 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" placeholder="Ask for plot ideas, chapter directions, or rewriting instructions..." />
                  </div>
                ) : null}

                {activeWriterTab === 'characters' ? (
                  <div className="space-y-3">
                    <button className="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">+ Add character note</button>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-sm font-semibold">Lead character</p>
                      <p className="mt-2 text-xs text-slate-500">Track names, goals, flaws, and relationship changes as the manuscript grows.</p>
                    </div>
                  </div>
                ) : null}

                {activeWriterTab === 'structure' ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-sm font-semibold">Outline tracker</p>
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <p className="font-semibold">Opening</p>
                          <p className="text-xs text-slate-500">Set the first hook inside page one.</p>
                        </div>
                        <div>
                          <p className="font-semibold">Middle</p>
                          <p className="text-xs text-slate-500">Use the page navigator to move through long manuscripts.</p>
                        </div>
                        <div>
                          <p className="font-semibold">Ending</p>
                          <p className="text-xs text-slate-500">Reserve the final pages for resolution and appendix notes.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeWriterTab === 'notes' ? (
                  <div className="flex h-full flex-col gap-3">
                    <p className="text-xs text-slate-500">Private scratchpad for ideas that should not enter the main document.</p>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-72 flex-1 rounded-2xl border border-yellow-200 bg-yellow-50/70 p-3 text-sm outline-none dark:border-yellow-900/40 dark:bg-yellow-900/10" placeholder="Jot down loose notes, references, or scene reminders..." />
                  </div>
                ) : null}
              </div>
            </aside>
          ) : (
            <button onClick={() => setIsRightSidebarOpen(true)} className="absolute right-4 top-4 z-20 rounded-2xl px-3 py-2 text-sm font-semibold text-white shadow-lg" style={{ backgroundColor: theme.accent }}>Open writer tools</button>
          )}
        </div>
      </div>

      {isShareModalOpen ? (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold"><Share2 className="h-4 w-4" style={{ color: theme.accent }} /> Share document</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Invite by email or Ndovera ID</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="alice@example.com" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900" />
                  <select className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-900">
                    <option>Editor</option>
                    <option>Commenter</option>
                    <option>Viewer</option>
                  </select>
                </div>
              </div>
              <button className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: theme.accent }}>Send invite</button>
              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">People with access</p>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">You</p>
                    <p className="text-xs text-slate-500">author@ndovera.com</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">Owner</span>
                </div>
                {collaborators.map((collaborator, index) => (
                  <div key={`${collaborator.name}_${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: collaborator.color }}>
                        {collaborator.name ? collaborator.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{collaborator.name}</p>
                        <p className="text-xs text-slate-500">Active now</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Editor</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
