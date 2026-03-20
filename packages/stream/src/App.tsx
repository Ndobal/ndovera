import { useState, useRef, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { FeedItem } from './components/FeedItem';
import { InputArea } from './components/InputArea';
import { EmojiDrawer } from './components/EmojiDrawer';
import { ProfileModal } from './components/ProfileModal';
import { Post, Author } from './types';
import { initialPosts } from './constants/mockData';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [inputText, setInputText] = useState('');
  const [drawerConfig, setDrawerConfig] = useState<{ isOpen: boolean, onSelect: (emoji: string) => void }>({ isOpen: false, onSelect: () => {} });
  const [selectedProfile, setSelectedProfile] = useState<Author | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUserIsAdmin = true; // Mock admin status

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [posts]);

  const toggleTheme = () => setIsDark(!isDark);

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id !== postId) return post;
      if (post.userLiked) {
        return { ...post, userLiked: false, likes: post.likes - 1 };
      } else {
        return {
          ...post,
          userLiked: true,
          likes: post.likes + 1,
          userDisliked: false,
          dislikes: post.userDisliked ? post.dislikes - 1 : post.dislikes
        };
      }
    }));
  };

  const handleDislike = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id !== postId) return post;
      if (post.userDisliked) {
        return { ...post, userDisliked: false, dislikes: post.dislikes - 1 };
      } else {
        return {
          ...post,
          userDisliked: true,
          dislikes: post.dislikes + 1,
          userLiked: false,
          likes: post.userLiked ? post.likes - 1 : post.likes
        };
      }
    }));
  };

  const handleToggleReaction = (postId: string, emoji: string) => {
    setPosts(posts.map(post => {
      if (post.id !== postId) return post;
      const existing = post.reactions.find(r => r.emoji === emoji);
      let newReactions = [...post.reactions];
      if (existing) {
        if (existing.userReacted) {
          newReactions = newReactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r).filter(r => r.count > 0);
        } else {
          newReactions = newReactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r);
        }
      } else {
        newReactions.push({ emoji, count: 1, userReacted: true });
      }
      return { ...post, reactions: newReactions };
    }));
  };

  const handlePost = (content: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
      author: {
        name: 'Current User',
        avatar: 'https://picsum.photos/seed/currentuser/150/150',
        position: 'Admin / Creator'
      },
      content,
      timestamp: new Date(),
      likes: 0,
      dislikes: 0,
      userLiked: false,
      userDisliked: false,
      reactions: []
    };
    setPosts([...posts, newPost]);
  };

  const handlePostMedia = (type: 'audio' | 'video' | 'image' | 'file', url: string, name?: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
      author: {
        name: 'Current User',
        avatar: 'https://picsum.photos/seed/currentuser/150/150',
        position: 'Admin / Creator'
      },
      content: '',
      media: { type, url, name, status: 'available' },
      timestamp: new Date(),
      likes: 0,
      dislikes: 0,
      userLiked: false,
      userDisliked: false,
      reactions: [],
      isSeen: false
    };
    setPosts([...posts, newPost]);
  };

  const handleEdit = (postId: string, newContent: string) => {
    setPosts(posts.map(post => {
      if (post.id !== postId) return post;
      return { ...post, content: newContent, isEdited: true, editedAt: new Date() };
    }));
  };

  const handleDelete = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id !== postId) return post;
      return { ...post, isDeleted: true };
    }));
  };

  const handleRequestMedia = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id !== postId || !post.media) return post;
      return { ...post, media: { ...post.media, status: 'requested' } };
    }));
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors relative selection:bg-indigo-500/30">
        {/* Dark mode background blobs for glassmorphism */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden hidden dark:block">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-purple-600/20 rounded-full blur-[100px]" />
        </div>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-20 bg-white dark:bg-slate-950/50 dark:backdrop-blur-md border-b border-slate-200 dark:border-white/10">
          <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
            <h1 className="text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">GlassStream</h1>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Main Feed */}
        <main className="relative z-10 max-w-3xl mx-auto px-4 pt-16 pb-20 flex flex-col">
          {posts.map(post => (
            <FeedItem
              key={post.id}
              post={post}
              isCurrentUser={post.author.name === 'Current User'}
              onLike={() => handleLike(post.id)}
              onDislike={() => handleDislike(post.id)}
              onReact={() => setDrawerConfig({
                isOpen: true,
                onSelect: (emoji) => handleToggleReaction(post.id, emoji)
              })}
              onToggleReaction={(emoji) => handleToggleReaction(post.id, emoji)}
              onProfileClick={(author) => setSelectedProfile(author)}
              onEdit={(newContent) => handleEdit(post.id, newContent)}
              onDelete={() => handleDelete(post.id)}
              onRequestMedia={() => handleRequestMedia(post.id)}
            />
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <InputArea
          text={inputText}
          onChange={setInputText}
          onPost={handlePost}
          onPostMedia={handlePostMedia}
          onOpenEmoji={() => setDrawerConfig({
            isOpen: true,
            onSelect: (emoji) => setInputText(prev => prev + emoji)
          })}
        />

        {/* Emoji Drawer */}
        <EmojiDrawer
          isOpen={drawerConfig.isOpen}
          onClose={() => setDrawerConfig({ ...drawerConfig, isOpen: false })}
          onSelect={(emoji) => {
            drawerConfig.onSelect(emoji);
            setDrawerConfig({ ...drawerConfig, isOpen: false });
          }}
        />

        {/* Profile Modal */}
        <ProfileModal
          isOpen={!!selectedProfile}
          onClose={() => setSelectedProfile(null)}
          author={selectedProfile}
          isAdmin={currentUserIsAdmin}
        />
      </div>
    </div>
  );
}
