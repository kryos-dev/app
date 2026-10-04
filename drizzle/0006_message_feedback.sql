-- Thumbs up / thumbs down per assistant message. The existing `feedback`
-- table is free-text app feedback and has no message to hang a rating on.
CREATE TABLE IF NOT EXISTS "message_feedback" (
	"message_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "message_feedback_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_messages_id_fk"
	FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
