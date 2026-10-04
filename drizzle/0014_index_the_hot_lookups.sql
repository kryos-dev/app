-- Every message read in this app was a sequential scan.
--
-- `messages.chat_id` is a foreign key, and Postgres does NOT index a foreign
-- key column -- it indexes the key it POINTS AT. So the one query the chat UI
-- runs constantly
--
--   select * from messages where chat_id = $1 order by created_at, id
--
-- had nothing to use, on the table that grows fastest here. Before this the
-- only index in the whole app was search_cache_fetched_at_idx.
--
-- Composite, in the order the query needs: equality column first, then the two
-- sort columns, so one index serves both the WHERE and the ORDER BY and the
-- planner never sorts. `id` is in it because created_at alone is not a total
-- order (see 0013) and the route sorts by both.
CREATE INDEX IF NOT EXISTS "messages_chat_id_created_at_id_idx"
  ON "messages" ("chat_id", "created_at", "id");

-- The sidebar: select ... from chats where user_id = $1 order by pinned...
-- Same story -- user_id is a foreign key, so it was unindexed too.
CREATE INDEX IF NOT EXISTS "chats_user_id_updated_at_idx"
  ON "chats" ("user_id", "updated_at" DESC);

-- Written on every persisted turn and read by the ownership guard on every
-- request that touches a chat.
CREATE INDEX IF NOT EXISTS "messages_user_id_idx"
  ON "messages" ("user_id");
