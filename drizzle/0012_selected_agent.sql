-- The header agent picker saved selected_agent_id, but no column existed, so
-- the choice (e.g. OpenCode) was dropped and the picker fell back to Hermes.
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "selected_agent_id" text;
