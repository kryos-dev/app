-- One Hermes session per chat: the conversation lives server-side, each turn
-- sends only its newest message.
ALTER TABLE "chats" ADD COLUMN "hermes_session_id" text;
