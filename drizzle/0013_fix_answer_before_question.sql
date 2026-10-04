-- Answers stamped BEFORE the question that produced them.
--
-- app/api/chat/route.ts read the clock into `turnStartedAt` and only then
-- inserted the user row, which took the column default `now()` -- a few
-- hundred microseconds later. Messages are read back `order by created_at,
-- id`, so every assistant row written by that code sorts above its own user
-- row. Measured on live rows 2026-09-22:
--
--   478 | assistant | 14:41:22.160000+00
--   477 | user      | 14:41:22.160376+00
--
-- The route is fixed (the answer is now derived from the question's stored
-- timestamp). This repairs the history: an assistant row that sorts at or
-- before the user row directly preceding it by id is moved to one millisecond
-- after it.
--
-- Idempotent -- the WHERE clause matches nothing on a second pass -- and it
-- touches only `created_at`, never message content.

WITH pairs AS (
  SELECT
    m.id AS assistant_id,
    prev.created_at AS user_created_at
  FROM messages m
  JOIN LATERAL (
    SELECT p.created_at, p.role
    FROM messages p
    WHERE p.chat_id = m.chat_id
      AND p.id < m.id
    ORDER BY p.id DESC
    LIMIT 1
  ) prev ON true
  WHERE m.role = 'assistant'
    AND prev.role = 'user'
    AND m.created_at <= prev.created_at
)
UPDATE messages m
SET created_at = pairs.user_created_at + interval '1 millisecond'
FROM pairs
WHERE m.id = pairs.assistant_id;
