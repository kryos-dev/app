import { requireAdmin } from "@/lib/auth/guards"
import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

export async function GET() {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const res = await dashboard.cronJobs()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  // The "Deliver to" options ride along on the same round trip; best-effort.
  const targetsRes = await dashboard.deliveryTargets()
  return NextResponse.json({
    jobs: res.data,
    deliveryTargets: targetsRes.ok ? targetsRes.data.targets : [],
  })
}

// Body is forwarded as CronJobCreate: name, schedule, prompt, deliver.
export async function POST(request: Request) {
  const { response: denied } = await requireAdmin()
  if (denied) return denied

  const body = await request.json().catch(() => null)
  if (typeof body?.schedule !== "string" || !body.schedule.trim()) {
    return NextResponse.json({ error: "schedule is required" }, { status: 400 })
  }
  const create: Record<string, unknown> = { schedule: body.schedule.trim() }
  for (const key of ["name", "prompt", "deliver"] as const) {
    if (typeof body[key] === "string" && body[key].trim()) create[key] = body[key].trim()
  }

  const res = await dashboard.createCronJob(create)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ created: true, job: res.data })
}
