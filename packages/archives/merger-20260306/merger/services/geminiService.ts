
// NOTE: All live AI calls have been disabled in the public build
// to avoid exposing any API keys or external services from the
// browser. These helpers now return safe, local fallbacks.

export const sendMessageToNdove = async (
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  imageData?: { data: string; mimeType: string }
): Promise<string> => {
  console.warn('Ndove AI is disabled in this public demo build.');
  // Basic echo-style helper so the UI remains usable
  const latestUserInput = message || history[history.length - 1]?.text || '';
  if (!latestUserInput) {
    return "AI assistance is disabled in this public demo. Please contact your administrator for academic help.";
  }
  return `AI assistance is disabled in this public demo. You asked: "${latestUserInput}"`;
};

/**
 * Local-only text check stub. Always avoids calling external services
 * and simply echoes the provided text back as the "correct" version.
 */
export const checkTextQuality = async (text: string): Promise<{ hasErrors: boolean; corrections: string; explanation: string }> => {
  console.warn('Text quality audit is disabled in this public demo build.');
  return {
    hasErrors: false,
    corrections: text,
    explanation: 'Automated text auditing is disabled in the public demo. For compliance reviews, use your internal tooling.'
  };
};

// --- LIVE API UTILS ---

export function encodeAudio(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeAudio(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeAudio(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
