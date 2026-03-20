

import { GoogleGenAI, Type, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are Tutor Ndove, a friendly and smart AI teacher for the Ndovera platform.
Ndovera is a school system designed for African students.

YOUR GOALS:
1. Explain complex things using simple, everyday English.
2. Be encouraging! Use emojis like 🌟, 🚀, and 📚.
3. If an image is provided (like a math problem), analyze it carefully and explain the steps.
4. Keep math formulas simple. Use '/' for divide and '*' for multiply.
5. You only talk about school subjects.
`;

export const sendMessageToNdove = async (
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  imageData?: { data: string; mimeType: string } // Added for Vision support
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    
    // Convert history for the chat session
    const chatHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: chatHistory,
    });

    if (imageData) {
      // Vision request uses generateContent with multiple parts
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: message },
            { inlineData: imageData }
          ]
        },
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });
      return result.text || "I'm looking at your image... can you tell me more about it? 🖼️";
    }

    const result = await chat.sendMessage({ message });
    return result.text || "I'm thinking... can you ask that again? 🧠";
  } catch (error) {
    console.error("Ndove Error:", error);
    return "I lost my connection to the library! Please check your internet. 📡";
  }
};

/**
 * Audits text for institutional professionalism and grammar using Gemini 3 Flash.
 * Returns a structured JSON response.
 */
export const checkTextQuality = async (text: string): Promise<{ hasErrors: boolean; corrections: string; explanation: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Audit the following text for institutional professionalism, grammar, and clarity suitable for a school environment. 
      If it is already professional and clear, set hasErrors to false. 
      If improvements are needed, provide the corrected version and a brief explanation.
      
      Text to audit: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasErrors: {
              type: Type.BOOLEAN,
              description: "Whether the text needs corrections."
            },
            corrections: {
              type: Type.STRING,
              description: "The professionally corrected version of the text."
            },
            explanation: {
              type: Type.STRING,
              description: "Brief explanation of the audit findings."
            }
          },
          required: ["hasErrors", "corrections", "explanation"]
        }
      }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Audit Error:", error);
    return {
      hasErrors: false,
      corrections: text,
      explanation: "The automated audit service is temporarily unavailable."
    };
  }
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
