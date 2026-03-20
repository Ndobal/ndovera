import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiModel = "gemini-3-flash-preview";

export async function getTranscriptionSummary(transcript: string) {
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: `Summarize the following meeting transcript into key takeaways and action items:\n\n${transcript}`,
    config: {
      systemInstruction: "You are an expert meeting assistant. Provide concise, actionable summaries.",
    },
  });
  return response.text;
}

export async function askAIAssistant(question: string, context: string) {
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: `Context from meeting:\n${context}\n\nQuestion: ${question}`,
    config: {
      systemInstruction: "You are Auralis AI, a helpful virtual classroom assistant. Use the provided meeting context to answer questions accurately.",
    },
  });
  return response.text;
}

export async function analyzeTone(text: string) {
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: `Analyze the sentiment and tone of this message: "${text}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sentiment: { type: Type.STRING },
          score: { type: Type.NUMBER },
          suggestion: { type: Type.STRING }
        },
        required: ["sentiment", "score", "suggestion"]
      }
    }
  });
  return JSON.parse(response.text);
}
