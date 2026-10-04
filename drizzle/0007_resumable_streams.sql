-- The stream in flight for a chat, so a client that navigated away can
-- re-attach to it instead of watching a stalled screen until a reload.
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "active_stream_id" text;
