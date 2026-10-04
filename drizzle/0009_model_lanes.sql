-- Model lanes, editable at runtime.
--
-- The picker used to be a hardcoded array in lib/models/data/litellm.ts plus a
-- hardcoded allow-list in lib/config.ts. Both drifted: they still listed
-- gpt-oss-120b, gemini-2.5-pro, mistral-small-2603 and nemotron-3.5-lightning
-- weeks after those lanes were deleted from deploy/config/litellm/config.yaml,
-- so half the picker was models that 404 when you send to them.
--
-- The live list now comes from LiteLLM itself. This table holds only what
-- LiteLLM cannot know: whether the owner wants a lane in the picker, what to
-- call it, and what order to show it in. A lane with no row here is shown with
-- its raw id, which is why the table can be empty and everything still works.
CREATE TABLE IF NOT EXISTS "model_lanes" (
  "id" text PRIMARY KEY NOT NULL,
  "label" text,
  "description" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  -- true when the row was typed in rather than seen on LiteLLM. Such a lane is
  -- offered in the picker even though /model/info does not list it, because
  -- the owner may add the lane to LiteLLM's config a minute later.
  "manual" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
