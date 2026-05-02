export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PROPRIETOR = 'PROPRIETOR',
  HOS = 'HOS',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
  BURSAR = 'BURSAR',
  LIBRARIAN = 'LIBRARIAN',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Message {
  id: string;
  senderId: string;
  conversationId: string;
  text: string;
  timestamp: number;
  readBy: string[];
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: Message;
  unreadCount: number;
}
