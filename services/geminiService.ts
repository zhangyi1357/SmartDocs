import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message, Role, UsageStats } from "../types";

// Initialize Gemini Client
// Note: API Key must be provided via environment variable.
// We support both standard process.env (for Node/Cloud) and Vite's import.meta.env (for local dev)
const getClient = () => {
  const apiKey = process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing. Please set process.env.API_KEY or VITE_API_KEY in your .env file.");
  }
  return new GoogleGenAI({ apiKey });
};

const MODEL_NAME = "gemini-3-flash-preview";

export const buildSystemInstruction = (context: string) => {
  return `
    You are an expert technical support agent for a specific SDK/Product. 
    You have been provided with the following "Knowledge Base" consisting of documentation and historical Q&A.
    
    --- START KNOWLEDGE BASE ---
    ${context}
    --- END KNOWLEDGE BASE ---

    INSTRUCTIONS:
    1. Your primary goal is to answer user questions accurately based ONLY on the provided Knowledge Base.
    2. If the user's question can be answered by the Knowledge Base, provide a clear, technical, and helpful response. Use code snippets if relevant.
    3. If the user's question is NOT found in the Knowledge Base or is not a general greeting (like "hi", "hello"), you MUST strictly reply with a variation of: "I'm sorry, but this specific issue isn't covered in my current documentation. Please contact our support team at support@example.com for further assistance."
    4. Do not hallucinate features or APIs that are not in the provided text.
    5. Maintain a professional, empathetic, and polite tone.
  `.trim();
}

export const estimateTokenCount = async (text: string): Promise<number> => {
  try {
    const ai = getClient();
    const response = await ai.models.countTokens({
      model: MODEL_NAME,
      contents: [{ parts: [{ text }] }],
    });
    return response.totalTokens || 0;
  } catch (error) {
    console.warn("Failed to count tokens", error);
    return 0;
  }
};

export const createChatSession = (context: string) => {
  const ai = getClient();
  const systemInstruction = buildSystemInstruction(context);

  return ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.2, // Low temperature for factual accuracy
    },
  });
};

export const sendMessageStream = async (
  chat: Chat, 
  message: string, 
  onChunk: (text: string) => void
): Promise<{ text: string, usage?: UsageStats }> => {
  try {
    const result = await chat.sendMessageStream({ message });
    let fullText = "";
    let finalUsage: UsageStats | undefined = undefined;

    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
      if (c.usageMetadata) {
        finalUsage = {
          promptTokenCount: c.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: c.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: c.usageMetadata.totalTokenCount || 0,
        };
      }
    }
    return { text: fullText, usage: finalUsage };
  } catch (error: any) {
    console.error("Error sending message to Gemini:", error);
    
    // Improve error message for the specific "status code 0" / network error
    let errorMessage = "An error occurred while communicating with the AI.";
    
    if (error.message?.includes("http status code: 0") || error.status === "UNKNOWN") {
      errorMessage = "Connection failed. This could be due to a network issue, an invalid API Key, or a browser extension blocking the request.";
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
};