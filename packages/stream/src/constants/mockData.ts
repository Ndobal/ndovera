import { Post } from '../types';

export const initialPosts: Post[] = [
  {
    id: '3',
    author: {
      name: 'System',
      avatar: 'https://picsum.photos/seed/system/150/150',
      position: 'Server'
    },
    content: 'Welcome! Messages are saved on the server, but large media files are stored P2P on user devices. If a user is offline or the media is old, you can request it from them.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    likes: 0,
    dislikes: 0,
    userLiked: false,
    userDisliked: false,
    reactions: [],
    isSeen: true
  },
  {
    id: '2',
    author: {
      name: 'Marcus Chen',
      avatar: 'https://picsum.photos/seed/marcus/150/150',
      position: 'Frontend Engineer'
    },
    content: 'Here is that design file you asked for. It is pretty large so it is only on my local device right now.',
    media: {
      type: 'file',
      name: 'design_assets_v2.zip',
      status: 'unavailable'
    },
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    likes: 128,
    dislikes: 4,
    userLiked: true,
    userDisliked: false,
    reactions: [
      { emoji: '💯', count: 12, userReacted: false },
      { emoji: '😂', count: 45, userReacted: true }
    ],
    isSeen: true
  },
  {
    id: '1',
    author: {
      name: 'Sarah Jenkins',
      avatar: 'https://picsum.photos/seed/sarah/150/150',
      position: 'Product Manager'
    },
    content: 'Just deployed the new glassmorphism UI for our social feed. The backdrop-blur combined with subtle borders looks absolutely stunning in dark mode! ✨🎨',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    likes: 42,
    dislikes: 1,
    userLiked: false,
    userDisliked: false,
    reactions: [
      { emoji: '🔥', count: 5, userReacted: true },
      { emoji: '🚀', count: 3, userReacted: false },
      { emoji: '👀', count: 8, userReacted: false }
    ],
    isSeen: true
  }
];
