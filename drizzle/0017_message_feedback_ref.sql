-- Messages now live in the Hermes transcript, so a vote points at a message by
-- its text reference ("12" for a stored row, "h345" for a Hermes row) instead of
-- a messages.id foreign key. chat_id keeps the vote tied to its chat, so
-- deleting the chat still deletes the votes.
ALTER TABLE "message_feedback" ADD COLUMN "message_ref" text;
--> statement-breakpoint
ALTER TABLE "message_feedback" ADD COLUMN "chat_id" uuid;
--> statement-breakpoint
UPDATE "message_feedback" f SET "message_ref" = f."message_id"::text, "chat_id" = m."chat_id"
	FROM "messages" m WHERE m."id" = f."message_id";
--> statement-breakpoint
ALTER TABLE "message_feedback" ALTER COLUMN "message_ref" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "message_feedback" ALTER COLUMN "chat_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "message_feedback" DROP CONSTRAINT "message_feedback_message_id_user_id_pk";
--> statement-breakpoint
ALTER TABLE "message_feedback" DROP COLUMN "message_id";
--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_ref_user_id_pk" PRIMARY KEY("message_ref","user_id");
--> statement-breakpoint
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_chat_id_chats_id_fk"
	FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;
