import { GoogleGenAI, Type } from "@google/genai";
import { QuestionLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ClassificationResult {
  level: QuestionLevel;
  category: string;
}

export async function classifyQuestion(text: string): Promise<ClassificationResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `다음 교육적 질문을 수준(1, 2, 3)과 짧은 카테고리 명칭(한글)으로 분류해주세요.
      수준 1: 단순 지식 확인, 정의, 사실 관계.
      수준 2: 추론, 탐구, 이유와 원리, 원칙 탐색.
      수준 3: 비판적 사고, 창의적 적용, 복잡한 종합 및 제언.
      
      질문: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "1, 2, 또는 3" },
            category: { type: Type.STRING, description: "짧은 한글 카테고리 이름 (예: 테크, 인프라, 윤리 등)" }
          },
          required: ["level", "category"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"level": 1, "category": "General"}');
    return {
      level: (result.level >= 1 && result.level <= 3) ? result.level as QuestionLevel : 1,
      category: result.category || "General"
    };
  } catch (error) {
    console.error("AI Classification failed:", error);
    return { level: 1, category: "General" };
  }
}

export async function detectSimilarQuestions(newQuestion: string, existingQuestions: {id: string, text: string}[]): Promise<string | null> {
  if (existingQuestions.length === 0) return null;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I have a new question and a list of existing questions. 
      If the new question is very similar to any of the existing ones, return the ID of the most similar question.
      Otherwise, return null.
      
      New Question: "${newQuestion}"
      Existing Questions:
      ${JSON.stringify(existingQuestions)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            similarId: { type: Type.STRING, nullable: true }
          }
        }
      }
    });
    
    const result = JSON.parse(response.text || '{"similarId": null}');
    return result.similarId || null;
  } catch (error) {
    return null;
  }
}
