-- Answers stamped BEFORE their question, second pass.
--
-- 0013 repaired an assistant row only when the row DIRECTLY before it by id
-- was its user row. Ten live rows (ids 306, 352-354, 409-411, 432, 434-435;
-- all from 2026-09-19/20, none since the route fix shipped) sit behind another
-- assistant row -- a multi-part turn -- and were skipped, with created_at
-- running minutes before the question and, in one group, backwards:
--
--   409 | assistant | 18:01:49.230
--   410 | assistant | 17:58:44.025
--   411 | assistant | 17:53:27.534
--   404 | user      | 18:01:49.230244    (their question)
--
-- Same repair, wider match: the nearest PRECEDING USER row by id, however
-- many assistant rows lie between. Messages read `order by created_at, id`,
-- so the question comes first and the assistant parts keep their id order.
--
-- Idempotent -- the WHERE clause matches nothing on a second pass -- and it
-- touches only `created_at`, never message content.

WITH pairs AS (
  SELECT
    m.id AS assistant_id,
    u.created_at AS user_created_at
  FROM messages m
  JOIN LATERAL (
    SELECT p.created_at
    FROM messages p
    WHERE p.chat_id = m.chat_id
      AND p.role = 'user'
      AND p.id < m.id
    ORDER BY p.id DESC
    LIMIT 1
  ) u ON true
  WHERE m.role = 'assistant'
    AND m.created_at <= u.created_at
)
UPDATE messages m
SET created_at = pairs.user_created_at + interval '1 millisecond'
FROM pairs
WHERE m.id = pairs.assistant_id;
