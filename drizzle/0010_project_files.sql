-- Files uploaded into a project. lib/projects/context.ts reads the `text`
-- column of every row here and folds it into the project's instructions for
-- every chat in the project -- see 0005_project_instructions.sql for the
-- column that holds the instructions themselves.
CREATE TABLE IF NOT EXISTS "project_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "file_url" text NOT NULL,
  "file_name" text NOT NULL,
  "file_type" text,
  "file_size" integer,
  "text" text,
  "created_at" timestamp with time zone DEFAULT now()
);
