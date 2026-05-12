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
      contents: `다음 교육적 질문을 수준(1~5)과 짧은 카테고리 명칭(한글)으로 분류해주세요.
      수준 1: 단순 지식 확인, 사실 관계, 정의 등 가장 기초적인 단계.
      수준 2: 이해도 점검, 요약, 설명, 범주화 단계.
      수준 3: 배운 내용의 적용, 사례 연결, 문제 해결을 위한 시도 단계.
      수준 4: 추론, 분석, 논리적 증명, 비판적 탐구 단계.
      수준 5: 창의적 제언, 복잡한 종합, 가치 평가, 새로운 관점 제시 등 최고 난이도 단계.
      
      질문: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            level: { type: Type.INTEGER, description: "1, 2, 3, 4, 5 중 하나" },
            category: { type: Type.STRING, description: "짧은 한글 카테고리 이름 (예: 테크, 인프라, 윤리 등)" }
          },
          required: ["level", "category"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"level": 1, "category": "일반"}');
    return {
      level: (result.level >= 1 && result.level <= 5) ? result.level as QuestionLevel : 1,
      category: result.category || "일반"
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
