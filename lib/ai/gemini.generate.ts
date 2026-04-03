import { getGeminiClient, GEMINI_MODEL } from "./gemini.client";
import { getSystemInstruction } from "./prompts/factory";
import { parseResponse } from "./responseParser";
import { WorkflowResponse } from "@/types/workflow";

export async function generateWorkflowPlan(
  userInput: string,
  history: { role: string; parts: { text: string }[] }[] = [],
  modelName: string = GEMINI_MODEL
): Promise<WorkflowResponse> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: getSystemInstruction(modelName),
  });

  let responseText = "";

  if (history.length > 0) {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(
      `User Update: "${userInput}"\n\nGenerate the completely updated JSON workflow blueprint respecting all previous constraints.`
    );
    responseText = result.response.text();
  } else {
    const result = await model.generateContent(
      `User Request: "${userInput}"\n\nGenerate the complete JSON workflow representation.`
    );
    responseText = result.response.text();
  }

  return parseResponse(responseText);
}
