import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateLessonNote = async (topic: string, subject: string, classLevel: string) => {
  if (!apiKey) {
    console.warn("No Gemini API key found. Using mock responses for frontend development.");
    // Return mock data for frontend development
    return {
      topic: "Sample Topic",
      subtopic: "Sample Subtopic",
      objectives: ["Objective 1", "Objective 2"],
      introduction: "This is a sample introduction.",
      body: "Sample lesson body content.",
      activities: ["Activity 1", "Activity 2"],
      assessment: ["Assessment 1", "Assessment 2"],
      summary: "Sample summary.",
      references: ["Reference 1", "Reference 2"]
    };
  }

  const response = await ai?.generateContent({
    model: "gemini-1.0.0",
    prompt: {
      topic,
      subject,
      classLevel,
    },
    required: ["topic", "subtopic", "objectives", "introduction", "body", "activities", "assessment", "summary", "references"],
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Failed to generate lesson note content.");
  }
};
