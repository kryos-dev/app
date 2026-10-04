import { dashboard } from "@/lib/cloud9/dashboard"
import { encodeModelId } from "@/lib/hermes/client"
import { HERMES_AGENT_MODEL } from "./index"
import { ModelConfig } from "./types"

// SERVER ONLY. The agent default first, then every model of every provider the
// dashboard reports as authenticated. Ids are "<provider>|<model>" so the
// chat route can send both to the gateway.
export async function getModelsWithAccessFlags(): Promise<ModelConfig[]> {
  const res = await dashboard.modelOptions()
  const models: ModelConfig[] = [{ ...HERMES_AGENT_MODEL, accessible: true }]
  if (!res.ok) return models
  for (const row of res.data.providers ?? []) {
    for (const model of row.models ?? []) {
      models.push({
        id: encodeModelId(row.slug, model),
        name: model,
        provider: row.name || row.slug,
        providerId: row.slug,
        baseProviderId: row.slug,
        reasoning: row.capabilities?.[model]?.reasoning,
        icon: row.slug,
        accessible: true,
      })
    }
  }
  return models
}
