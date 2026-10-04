ALTER TABLE "user_preferences" ALTER COLUMN "layout" SET DEFAULT 'sidebar';--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "prompt_suggestions" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "runtime_session_id" text;