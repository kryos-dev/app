-- Adds the folder a project's work happens in on the box, plus a short
-- description shown on the projects list. See lib/projects/context.ts for how
-- `folder` reaches the model's prompt.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "folder" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "description" text;
