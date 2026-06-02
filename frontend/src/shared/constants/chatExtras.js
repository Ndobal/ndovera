// Shared chat extras used by the school-wide messaging experiences (teachers, staff, students).

// ~200 emojis for the message composer picker.
export const CHAT_EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗',
  '😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕',
  '🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰',
  '😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤',
  '😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀',
  '☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊','💋','💌','💘',
  '💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💯','💢',
  '💥','💫','💦','💨','🕳️','💬','💭','💤','👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘',
  '🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️',
  '💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🌟',
];

// Sticker drawer — large expressive glyphs sent as their own message.
export const CHAT_STICKERS = [
  '👍🏽','🎉','🥳','😂','❤️','🔥','💯','👏🏽','🙏🏽','😎','🤩','😍','🤝','💪🏽','✅','⭐','🌟','🚀','💡','📚',
  '🎓','🏆','🥇','🎯','✨','🌈','☀️','🌻','🍎','✏️','📢','🔔','💌','🎁','🤔','😅','😴','🤗','🫶🏽','👀',
];

export function getChatInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

// Deterministic avatar colour from a name/id so each contact keeps a consistent colour.
export function getChatAvatarColor(seed) {
  const palette = ['#800020', '#1a5c38', '#191970', '#bf00ff', '#c2410c', '#0f766e', '#7c3aed', '#b91c1c'];
  const text = String(seed || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
