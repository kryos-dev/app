import { getModelsWithAccessFlags } from "@/lib/models/registry"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    return NextResponse.json({ models: await getModelsWithAccessFlags() })
  } catch (error) {
    console.error("Error fetching models:", error)
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 })
  }
}
