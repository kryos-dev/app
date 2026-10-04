import { ModelConfig } from "./types"

// CLIENT-SAFE: chat-input and the model picker import this, so it must not
// reach the database. "hermes-agent" is the id the gateway reads as "use the
// agent's own configured default"; the live list from the dashboard follows it.
export const HERMES_AGENT_MODEL: ModelConfig = {
  id: "hermes-agent",
  name: "Agent default",
  provider: "Hermes",
  providerId: "hermes",
  baseProviderId: "hermes",
  description: "The model the Hermes agent is configured with",
  vision: true,
  tools: true,
  reasoning: true,
  icon: "hermes",
}
