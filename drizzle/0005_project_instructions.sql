-- A project is a chat grouper with its own instructions. The page has said so
-- since it came back on 2026-09-13; the column it needs is this one.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "system_prompt" text;
