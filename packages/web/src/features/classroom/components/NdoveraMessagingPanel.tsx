import { useEffect, useMemo, useState } from 'react';
import { Headset, LoaderCircle, MessageSquareMore, Paperclip, Search, Send, Smile, Video } from 'lucide-react';

import { loadUser } from '../../../services/authLocal';
import { socialFeedEmojiGuide } from '../data/classroomExperience';
import { ClassroomMediaRecorder, type ClassroomMediaCapture } from './ClassroomMediaRecorder';
import {
  getMessagingContacts,
  getMessagingThread,
  sendMessagingThreadMessage,
  type NdoveraChatMessage,
  type NdoveraMessagingContact,
} from '../services/ndoveraMessagingApi';
import { listLocalChatMediaMessages, saveLocalChatMediaMessage, type LocalChatMediaKind } from '../services/localMessagingMedia';
import { SimpleWebRTC } from '../../../components/SimpleWebRTC';

type NdoveraMessagingPanelProps = {
  role: string;
};

type DeviceChatMessage = NdoveraChatMessage & {
  fileName?: string;
  fileSize?: number;
  kind: 'text' | 'media';
  localOnly?: boolean;
  mediaType?: LocalChatMediaKind;
  mediaUrl?: string;
  mimeType?: string;
};

const MAX_LOCAL_MEDIA_BYTES = 1024 * 1024 * 1024;

export function NdoveraMessagingPanel({ role }: NdoveraMessagingPanelProps) {
  const currentUser = loadUser();
  const [contacts, setContacts] = useState<NdoveraMessagingContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DeviceChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [emojiTarget, setEmojiTarget] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWebRTC, setShowWebRTC] = useState(false);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId],
  );
  const filteredContacts = useMemo(() => {
    const query = contactQuery.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const searchFields = [contact.name, contact.role, contact.subtitle, contact.identifier, contact.contextLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchFields.includes(query);
    });
  }, [contactQuery, contacts]);
  const emojiLibrary = useMemo(
    () => [...socialFeedEmojiGuide.map((item) => item.emoji), '🔥', '✅', '💡', '🎯', '🧠', '📘', '✍️', '🙌', '😮', '🤔', '💬', '🚀', '⭐', '📎', '🎉', '📌'],
    [],
  );

  const handleDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (sending || !selectedContactId || !draft.trim()) return;
    void sendMessage();
  };

  const formatMessageTime = (time: string) => {
    const parsed = new Date(time);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getContactTone = (contact: NdoveraMessagingContact) => {
    if (contact.kind === 'helpdesk') return 'is-helpdesk';
    if (contact.role === 'Teacher') return 'is-teacher';
    if (contact.role === 'Student') return 'is-student';
    return 'is-default';
  };

  const createMediaObjectUrl = (blob: Blob) => URL.createObjectURL(blob);

  const mergeMessages = (serverMessages: NdoveraChatMessage[], localMessages: Array<ReturnType<typeof mapLocalMediaToMessage>>) => {
    return [
      ...serverMessages.map((message) => ({ ...message, kind: 'text' as const })),
      ...localMessages,
    ].sort((left, right) => left.time.localeCompare(right.time));
  };

  const mapLocalMediaToMessage = (storedMessage: Awaited<ReturnType<typeof listLocalChatMediaMessages>>[number]): DeviceChatMessage => ({
    id: storedMessage.id,
    from: storedMessage.from,
    fromName: currentUser?.id === storedMessage.from ? 'You' : selectedContact?.name || 'Local media',
    to: storedMessage.to,
    text: storedMessage.text || '',
    time: storedMessage.createdAt,
    kind: 'media',
    localOnly: true,
    fileName: storedMessage.fileName,
    fileSize: storedMessage.size,
    mediaType: storedMessage.mediaType,
    mediaUrl: createMediaObjectUrl(storedMessage.blob),
    mimeType: storedMessage.mimeType,
  });

  const formatFileSize = (size: number) => {
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const classifyFile = (file: File): LocalChatMediaKind => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  };

  const appendLocalMediaMessage = async (file: File, mediaType: LocalChatMediaKind) => {
    if (!selectedContactId || !currentUser?.id) return;
    if (file.size > MAX_LOCAL_MEDIA_BYTES) {
      setError('Media files must be 1GB or smaller.');
      return;
    }

    const storedMessage = await saveLocalChatMediaMessage({
      file,
      from: currentUser.id,
      mediaType,
      ownerUserId: currentUser.id,
      peerId: selectedContactId,
      to: selectedContactId,
    });

    setMessages((current) => [...current, mapLocalMediaToMessage(storedMessage)].sort((left, right) => left.time.localeCompare(right.time)));
  };

  const handleLocalFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      await appendLocalMediaMessage(file, classifyFile(file));
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Unable to attach media on this device.');
    }
  };

  const handleRecorderComplete = async (capture: ClassroomMediaCapture) => {
    await appendLocalMediaMessage(capture.file, capture.type);
  };

  useEffect(() => {
    // Pull policy + contacts from the main Ndovera messaging backend so classroom users can chat in context.
    const loadMessagingContext = async () => {
      setLoadingContacts(true);
      setError(null);
      try {
        const nextContacts = await getMessagingContacts();
        setContacts(nextContacts);
        setSelectedContactId((current) => current || nextContacts[0]?.id || null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to load Ndovera chat.');
      } finally {
        setLoadingContacts(false);
      }
    };

    void loadMessagingContext();
  }, []);

  useEffect(() => {
    if (!selectedContactId) return;
    const loadThread = async () => {
      setLoadingThread(true);
      setError(null);
      try {
        const [nextThread, localMedia] = await Promise.all([
          getMessagingThread(selectedContactId),
          currentUser?.id ? listLocalChatMediaMessages(currentUser.id, selectedContactId) : Promise.resolve([]),
        ]);
        setMessages(mergeMessages(nextThread, localMedia.map(mapLocalMediaToMessage)));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to load this chat thread.');
      } finally {
        setLoadingThread(false);
      }
    };

    void loadThread();
  }, [currentUser?.id, selectedContactId]);

  useEffect(() => () => {
    messages.forEach((message) => {
      if (message.mediaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(message.mediaUrl);
      }
    });
  }, [messages]);

  const sendMessage = async () => {
    if (!selectedContactId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const response = await sendMessagingThreadMessage({ peerId: selectedContactId, text: draft.trim() });
      setMessages((current) => [...current, ...response.messages.map((message) => ({ ...message, kind: 'text' as const }))]);
      setDraft('');
      setEmojiTarget(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="grid grid-cols-1 overflow-hidden bg-[#020617] text-white lg:grid-cols-[320px_minmax(0,1fr)]"
      style={{ height: 'calc(100vh - 11rem)', minHeight: 'calc(100vh - 11rem)' }}
    >
      <aside className="flex h-full min-h-0 flex-col overflow-hidden border-b border-white/5 bg-[#020817] lg:border-b-0 lg:border-r">
        <div className="border-b border-white/5 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Ndovera Chat</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Messages</h2>
              <p className="mt-1 text-sm text-slate-400">School conversations, helpdesk support, voice notes, files, and quick live calls.</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-300">Role</div>
              <div className="text-sm font-semibold text-emerald-100">{role}</div>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              placeholder="Search staff, students, helpdesk"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>
        </div>

        <div className="ndovera-chat-sidebar-scroll flex-1 min-h-0 space-y-2 overflow-y-auto p-3">
          {loadingContacts ? (
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/3 px-4 py-4 text-sm text-slate-400">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/2 px-4 py-8 text-center text-sm text-slate-500">
              No chat contact matches this search.
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = contact.id === selectedContactId;
              const tone = getContactTone(contact);
              const accent = tone === 'is-helpdesk'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                : tone === 'is-teacher'
                  ? 'border-sky-500/30 bg-sky-500/10 text-sky-100'
                  : tone === 'is-student'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-slate-200';

              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    setSelectedContactId(contact.id);
                    setShowWebRTC(false);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${isSelected ? accent : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/5'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${isSelected ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-300'}`}>
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{contact.name}</div>
                        <div className="mt-1 text-xs text-slate-400">{contact.role}</div>
                        {contact.subtitle ? <div className="mt-2 truncate text-xs text-slate-500">{contact.subtitle}</div> : null}
                      </div>
                    </div>
                    <div className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      {contact.kind}
                    </div>
                  </div>
                  {(contact.contextLabel || contact.identifier) ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      {contact.contextLabel ? <span className="rounded-full bg-black/20 px-2.5 py-1">{contact.contextLabel}</span> : null}
                      {contact.identifier ? <span className="rounded-full bg-black/20 px-2.5 py-1">{contact.identifier}</span> : null}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_26%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
        <div className="border-b border-white/5 px-5 py-4 sm:px-6">
          {selectedContact ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 font-semibold text-emerald-200">
                    {selectedContact.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-white">{selectedContact.name}</div>
                    <div className="text-sm text-slate-400">{selectedContact.role}{selectedContact.contextLabel ? ` • ${selectedContact.contextLabel}` : ''}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWebRTC(false)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${!showWebRTC ? 'border-white/10 bg-white/10 text-white' : 'border-white/10 bg-transparent text-slate-300 hover:bg-white/5'}`}
                >
                  <MessageSquareMore className="mr-2 inline h-4 w-4" /> Chat thread
                </button>
                <button
                  type="button"
                  onClick={() => setShowWebRTC(true)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${showWebRTC ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-transparent text-slate-300 hover:bg-white/5'}`}
                >
                  <Video className="mr-2 inline h-4 w-4" /> Live call
                </button>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                  <Headset className="mr-2 inline h-4 w-4" /> Media stays on this device unless sent through the school server.
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-6 text-sm text-slate-500">
              Select a contact to start messaging.
            </div>
          )}
        </div>

        {error ? (
          <div className="mx-5 mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100 sm:mx-6">
            {error}
          </div>
        ) : null}

        {showWebRTC && selectedContact ? (
          <div className="ndovera-chat-thread-scroll flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
            <SimpleWebRTC targetUserId={selectedContact.id} onClose={() => setShowWebRTC(false)} />
          </div>
        ) : (
          <>
            <div className="ndovera-chat-thread-scroll flex-1 min-h-0 space-y-4 overflow-y-auto px-5 py-5 pb-28 sm:px-6 sm:pb-32">
              {loadingThread ? (
                <div className="flex h-full min-h-70 items-center justify-center rounded-3xl border border-white/5 bg-white/3 text-sm text-slate-400">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading thread...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full min-h-70 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/2 px-6 text-center text-slate-500">
                  <MessageSquareMore className="mb-3 h-8 w-8 text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">No messages yet</p>
                  <p className="mt-1 text-sm">Send the first message, attach a file, or record a quick voice note.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.from === currentUser?.id;
                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-3xl border px-4 py-3 shadow-sm ${isMine ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-50' : 'border-white/8 bg-white/4 text-slate-100'}`}>
                        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          <span>{isMine ? 'You' : message.fromName}</span>
                          <span>•</span>
                          <span>{formatMessageTime(message.time)}</span>
                        </div>

                        {message.kind === 'media' && message.mediaUrl ? (
                          <div className="space-y-3">
                            {message.mediaType === 'image' ? (
                              <img src={message.mediaUrl} alt={message.fileName || 'attachment'} className="max-h-72 w-full rounded-2xl object-cover" />
                            ) : null}
                            {message.mediaType === 'audio' ? (
                              <audio controls className="w-full">
                                <source src={message.mediaUrl} type={message.mimeType || 'audio/webm'} />
                              </audio>
                            ) : null}
                            {message.mediaType === 'video' ? (
                              <video controls className="max-h-72 w-full rounded-2xl">
                                <source src={message.mediaUrl} type={message.mimeType || 'video/webm'} />
                              </video>
                            ) : null}
                            {message.mediaType === 'file' ? (
                              <a href={message.mediaUrl} download={message.fileName} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                                <span className="min-w-0 truncate">{message.fileName || 'Attachment'}</span>
                                <span className="shrink-0 text-xs text-slate-400">{message.fileSize ? formatFileSize(message.fileSize) : 'Download'}</span>
                              </a>
                            ) : null}
                            {message.text ? <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p> : null}
                            {message.localOnly ? <div className="text-[11px] text-amber-200">Saved on this device.</div> : null}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="sticky bottom-0 z-20 border-t border-white/5 bg-[#020617]/95 px-5 py-3 backdrop-blur-xl sm:px-6">
              {emojiTarget ? (
                <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-white/8 bg-white/3 p-3">
                  {emojiLibrary.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setDraft((current) => `${current}${emoji}`);
                        setEmojiTarget(false);
                      }}
                      className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-lg transition hover:bg-white/10"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-3 rounded-[1.75rem] border border-white/10 bg-white/4 px-3 py-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder={selectedContact ? `Message ${selectedContact.name}` : 'Choose a contact to begin'}
                  disabled={!selectedContactId || sending}
                  className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white caret-emerald-300 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <div className="flex items-center gap-1.5 border-l border-white/8 pl-2">
                  <button
                    type="button"
                    onClick={() => setEmojiTarget((current) => !current)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-slate-300 transition hover:text-white"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent text-slate-300 transition hover:text-white">
                    <Paperclip className="h-4 w-4" />
                    <input type="file" className="hidden" onChange={handleLocalFilePick} />
                  </label>
                  <ClassroomMediaRecorder buttonVariant="bare" compact showWaveform={false} onCaptureComplete={handleRecorderComplete} disabled={!selectedContactId} />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={sending || !selectedContactId || !draft.trim()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-emerald-300 transition hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
