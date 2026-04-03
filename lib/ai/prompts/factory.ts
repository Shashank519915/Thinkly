import { GEMINI_MODEL } from "../gemini.client";
import * as GeminiBase from "./gemini/base";
import * as GeminiChat from "./gemini/chat";
import * as GeminiCompressed from "./gemini/compressed";
import * as GemmaBase from "./gemma/base";
import * as GemmaChat from "./gemma/chat";
import * as GemmaCompressed from "./gemma/compressed";

/**
 * Detects if the current model belongs to the Gemma family.
 * Gemma models require stricter technical instructions to prevent descriptive summaries.
 */
const isGemma = GEMINI_MODEL.toLowerCase().includes("gemma");

// 1. Base Generation Instructions
export const getSystemInstruction = isGemma 
  ? GemmaBase.getSystemInstruction 
  : GeminiBase.getSystemInstruction;

// 2. Full Chat Refinement Instructions
export const getChatSystemInstruction = isGemma 
  ? GemmaChat.getChatSystemInstruction 
  : GeminiChat.getChatSystemInstruction;

export const buildWorkflowContext = isGemma 
  ? GemmaChat.buildWorkflowContext 
  : GeminiChat.buildWorkflowContext;

// 3. Compressed History / High-Density Instructions
export const getCompressedChatSystemInstruction = isGemma 
  ? GemmaCompressed.validatePatch // placeholder for system instruction if different, but usually we use base or chat
  : GeminiCompressed.validatePatch; 

/**
 * Re-exporting structural utilities from the correct family.
 */
export const buildStructuralContext = isGemma 
  ? GemmaCompressed.buildStructuralContext 
  : GeminiCompressed.buildStructuralContext;

export const validatePatch = isGemma 
  ? GemmaCompressed.validatePatch 
  : GeminiCompressed.validatePatch;
