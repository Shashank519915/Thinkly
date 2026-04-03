import { NextRequest, NextResponse } from "next/server";
import { generateWorkflowPlan } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, model } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided." },
        { status: 400 }
      );
    }

    // Call the Gemini pipeline
    const workflowData = await generateWorkflowPlan(prompt, history || [], model);

    return NextResponse.json({ success: true, data: workflowData });
  } catch (error: any) {
    console.error("API Route Error:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "An unexpected error occurred during generation.",
        // Fallback or specific error hints could go here
      },
      { status: 500 }
    );
  }
}
