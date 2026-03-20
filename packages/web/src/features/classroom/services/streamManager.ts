// Reusable stream logic for classroom and subject streams
// This file provides a hook and utility functions to manage feed items, reactions, and media

import { useState, useEffect, useRef } from 'react';

// Local minimal Post/Author types to avoid cross-package type imports.
export interface Author {
  id: string;
  name?: string;
  avatarUrl?: string;
}

export interface Reaction { emoji: string; count: number; userReacted?: boolean }

export interface Post {
  id: string;
  author: Author;
  content: string;
  likes: number;
  dislikes: number;
  userLiked?: boolean;
  userDisliked?: boolean;
  reactions: Reaction[];
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  media?: { url: string; status?: string } | null;
}

export interface StreamManagerOptions {
  initialPosts?: Post[];
  currentUser?: Author;
}

export function useStreamManager({ initialPosts = [], currentUser }: StreamManagerOptions) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  // Scroll to bottom utility
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [posts]);

  // Like/dislike logic
  const handleLike = (postId: string) => {
    setPosts(posts => posts.map(post => {
      if (post.id !== postId) return post;
      if (post.userLiked) {
        return { ...post, userLiked: false, likes: post.likes - 1 };
      } else {
        return { ...post, userLiked: true, likes: post.likes + 1, userDisliked: false, dislikes: post.userDisliked ? post.dislikes - 1 : post.dislikes };
      }
    }));
  };

  const handleDislike = (postId: string) => {
    setPosts(posts => posts.map(post => {
      if (post.id !== postId) return post;
      if (post.userDisliked) {
        return { ...post, userDisliked: false, dislikes: post.dislikes - 1 };
      } else {
        return { ...post, userDisliked: true, dislikes: post.dislikes + 1, userLiked: false, likes: post.userLiked ? post.likes - 1 : post.likes };
      }
    }));
  };

  // Reaction logic
  const handleToggleReaction = (postId: string, emoji: string) => {
    setPosts(posts => posts.map(post => {
      if (post.id !== postId) return post;
      const reactions = post.reactions.map(r =>
        r.emoji === emoji ? { ...r, userReacted: !r.userReacted, count: r.userReacted ? r.count - 1 : r.count + 1 } : r
      );
      return { ...post, reactions };
    }));
  };

  // Edit/delete logic
  const handleEdit = (postId: string, newContent: string) => {
    setPosts(posts => posts.map(post => {
      if (post.id !== postId) return post;
      return { ...post, content: newContent, isEdited: true, editedAt: new Date() };
    }));
  };

  const handleDelete = (postId: string) => {
    setPosts(posts => posts.map(post => {
      if (post.id !== postId) return post;
      return { ...post, isDeleted: true };
    }));
  };

  // Media request logic
  const handleRequestMedia = (postId: string) => {
    setPosts(posts => posts.map(post => {
      if (post.id !== postId) return post;
      if (!post.media) return post;
      return { ...post, media: { ...post.media, status: 'requested' } };
    }));
  };

  return {
    posts,
    setPosts,
    handleLike,
    handleDislike,
    handleToggleReaction,
    handleEdit,
    handleDelete,
    handleRequestMedia,
    messagesEndRef,
    scrollToBottom,
  };
}
