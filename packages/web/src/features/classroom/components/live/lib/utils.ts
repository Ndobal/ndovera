import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Participant {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  isMuted: boolean;
  isCameraOff: boolean;
  isSharingScreen: boolean;
  isHandRaised: boolean;
  avatar?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isAI?: boolean;
}

export interface TranscriptionEntry {
  id: string;
  speakerName: string;
  text: string;
  timestamp: number;
}
