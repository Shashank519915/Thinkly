import { getGeminiClient } from "./gemini.client";
import { getSystemInstruction } from "./promptBuilder";
import { parseResponse } from "./responseParser";
import { WorkflowResponse } from "@/types/workflow";

export async function generateWorkflowPlan(
  userInput: string,
  history: { role: string; parts: { text: string }[] }[] = []
): Promise<WorkflowResponse> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: getSystemInstruction(),
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
