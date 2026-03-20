export type Reaction = {
  emoji: string;
  count: number;
  userReacted: boolean;
};

export type Author = {
  name: string;
  avatar: string;
  position?: string;
};

export type Media = {
  type: 'audio' | 'video' | 'image' | 'file';
  url?: string;
  name?: string;
  status: 'available' | 'unavailable' | 'requested';
};

export type Post = {
  id: string;
  author: Author;
  content: string;
  media?: Media;
  timestamp: Date;
  likes: number;
  dislikes: number;
  userLiked: boolean;
  userDisliked: boolean;
  reactions: Reaction[];
  isSeen?: boolean;
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
};
