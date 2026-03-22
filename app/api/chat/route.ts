import { NextRequest, NextResponse } from "next/server"
import { askWorkflowChat } from "@/lib/ai/gemini"
import { WorkflowResponse } from "@/types/workflow"

export async function POST(req: NextRequest) {
  try {
    const { question, workflow, originalPrompt, history } = await req.json()

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Invalid question." }, { status: 400 })
    }
    if (!workflow || typeof workflow !== "object") {
      return NextResponse.json({ error: "Workflow context is required." }, { status: 400 })
    }

    const result = await askWorkflowChat(
      question,
      workflow as WorkflowResponse,
      originalPrompt ?? "",
      history ?? []
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error("Chat API Error:", error)
    return NextResponse.json(
      { error: error.message || "Chat failed. Please try again." },
      { status: 500 }
    )
  }
}
