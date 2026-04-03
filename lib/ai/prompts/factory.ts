import * as GeminiBase from "./gemini/base";
import * as GeminiChat from "./gemini/chat";
import * as GeminiCompressed from "./gemini/compressed";
import * as GemmaBase from "./gemma/base";
import * as GemmaChat from "./gemma/chat";
import * as GemmaCompressed from "./gemma/compressed";

/**
 * Detects if a model belongs to the Gemma family.
 * Gemma models require stricter technical instructions to prevent descriptive summaries.
 */
const checkIsGemma = (modelName: string) => modelName.toLowerCase().includes("gemma");

// 1. Base Generation Instructions
export const getSystemInstruction = (modelName: string) => 
  checkIsGemma(modelName) 
    ? GemmaBase.getSystemInstruction() 
    : GeminiBase.getSystemInstruction();

// 2. Full Chat Refinement Instructions
export const getChatSystemInstruction = (modelName: string) => 
  checkIsGemma(modelName) 
    ? GemmaChat.getChatSystemInstruction() 
    : GeminiChat.getChatSystemInstruction();

export const buildWorkflowContext = (workflow: any, originalPrompt: string, modelName: string) => 
  checkIsGemma(modelName) 
    ? GemmaChat.buildWorkflowContext(workflow, originalPrompt) 
    : GeminiChat.buildWorkflowContext(workflow, originalPrompt);

// 3. Structural Utils
export const buildStructuralContext = (workflow: any, modelName: string) => 
  checkIsGemma(modelName) 
    ? GemmaCompressed.buildStructuralContext(workflow) 
    : GeminiCompressed.buildStructuralContext(workflow);

export const validatePatch = (patch: any, workflow: any, modelName: string) => 
  checkIsGemma(modelName) 
    ? GemmaCompressed.validatePatch(patch, workflow) 
    : GeminiCompressed.validatePatch(patch, workflow);
