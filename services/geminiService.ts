import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { TEXT_MODEL, SYSTEM_INSTRUCTION_TEXT } from "../constants";

let chatSession: Chat | null = null;

const getAiClient = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing");
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const initializeChat = () => {
  const ai = getAiClient();
  chatSession = ai.chats.create({
    model: TEXT_MODEL,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_TEXT,
      tools: [{ googleSearch: {} }], // Enable grounding for accurate Illescas info
    },
  });
};

export const sendMessageStream = async function* (message: string) {
  if (!chatSession) {
    initializeChat();
  }
  
  if (!chatSession) throw new Error("Chat session failed to initialize");

  try {
    const resultStream = await chatSession.sendMessageStream({ message });
    
    for await (const chunk of resultStream) {
      yield chunk as GenerateContentResponse;
    }
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};