import { NextRequest, NextResponse } from "next/server";
import { simulateBatchNodes } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const { nodes } = await req.json();

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: "Invalid nodes array." }, { status: 400 });
    }

    const steps = await simulateBatchNodes(nodes);

    return NextResponse.json({ success: true, steps });
  } catch (error: any) {
    console.error("Simulation API Error:", error);
    return NextResponse.json(
      { error: error.message || "Simulation data generation failed." },
      { status: 500 }
    );
  }
}
