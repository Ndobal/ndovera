import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateLessonNote = async (topic: string, subject: string, classLevel: string) => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `Generate a structured lesson note for the following:
    Topic: ${topic}
    Subject: ${subject}
    Class Level: ${classLevel}
    
    The response must be in JSON format matching the following structure:
    {
      "topic": "string",
      "subtopic": "string",
      "objectives": ["string"],
      "introduction": "string",
      "body": "string",
      "activities": ["string"],
      "assessment": ["string"],
      "summary": "string",
      "references": ["string"]
    }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          subtopic: { type: Type.STRING },
          objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          introduction: { type: Type.STRING },
          body: { type: Type.STRING },
          activities: { type: Type.ARRAY, items: { type: Type.STRING } },
          assessment: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
          references: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["topic", "subtopic", "objectives", "introduction", "body", "activities", "assessment", "summary", "references"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to generate lesson note content.");
  }
};
