/**
 * Check for the "answer sorts above its own question" bug and its repair.
 *
 *   node scripts/check-message-ordering.mjs
 *
 * Needs the local embedded Postgres (D:\sandbox\localpg, port 5433). It builds
 * a throwaway schema, writes rows the way the OLD route wrote them, asserts the
 * inversion is reproduced, runs drizzle/0013_fix_answer_before_question.sql,
 * and asserts every chat now reads question-then-answer. Then it writes rows
 * the way the NEW route writes them and asserts they were never inverted.
 * Last, it rebuilds the multi-part turns 0013 could not reach and asserts
 * drizzle/0015_answers_behind_interim_rows.sql repairs those.
 */
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SCHEMA = "ordering_fix_check"
const MIGRATION = path.join(__dirname, "..", "drizzle", "0013_fix_answer_before_question.sql")
const MIGRATION_PARTS = path.join(__dirname, "..", "drizzle", "0015_answers_behind_interim_rows.sql")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // The driver lib/db already uses; `pg` is not installed here. max: 1 keeps
  // `set search_path` on the one connection every later query runs on.
  const c = postgres({
    host: "127.0.0.1",
    port: 5433,
    user: "chat",
    password: "chat",
    database: "postgres",
    max: 1,
    connect_timeout: 5,
    onnotice: () => {},
  })

  await c.unsafe(`drop schema if exists ${SCHEMA} cascade`)
  await c.unsafe(`create schema ${SCHEMA}`)
  await c.unsafe(`set search_path to ${SCHEMA}`)
  await c.unsafe(`
    create table messages (
      id serial primary key,
      chat_id uuid not null,
      role text not null,
      content text,
      created_at timestamptz default now()
    )`)

  const chatOld = "11111111-1111-1111-1111-111111111111"
  const chatNew = "22222222-2222-2222-2222-222222222222"

  // --- the OLD route: clock read BEFORE the user insert -------------------
  // turnStartedAt = now + 1ms, then the user row takes the column default,
  // which lands later because the insert itself takes time.
  const TURNS = 5
  for (let i = 0; i < TURNS; i++) {
    const turnStartedAt = new Date(Date.now() + 1)
    await c.unsafe(
      `insert into messages (chat_id, role, content) values ($1,'user',$2)`,
      [chatOld, `question ${i}`]
    )
    await c.unsafe(
      `insert into messages (chat_id, role, content, created_at) values ($1,'assistant',$2,$3)`,
      [chatOld, `answer ${i}`, turnStartedAt]
    )
    await sleep(5)
  }

  const readBack = async (chatId) =>
          await c.unsafe(
        `select role, content from messages where chat_id = $1
         order by created_at asc, id asc`,
        [chatId]
      )
    

  const before = await readBack(chatOld)
  const inverted = before.filter((r, i) => r.role === "assistant" && i % 2 === 0).length
  assert.ok(
    inverted > 0,
    `expected the old write order to invert at least one turn, got none:\n${JSON.stringify(before, null, 1)}`
  )
  console.log(`reproduced: ${inverted}/${TURNS} answers sorted above their question`)

  // --- the repair ---------------------------------------------------------
  await c.unsafe(fs.readFileSync(MIGRATION, "utf8"))

  const assertWellOrdered = (rows, label) => {
    assert.strictEqual(rows.length, TURNS * 2, `${label}: wrong row count`)
    for (let i = 0; i < rows.length; i += 2) {
      assert.strictEqual(rows[i].role, "user", `${label}: row ${i} should be the question`)
      assert.strictEqual(rows[i + 1].role, "assistant", `${label}: row ${i + 1} should be the answer`)
      const n = i / 2
      assert.strictEqual(rows[i].content, `question ${n}`, `${label}: questions out of sequence`)
      assert.strictEqual(rows[i + 1].content, `answer ${n}`, `${label}: answers out of sequence`)
    }
    // The provider polls forever while the newest row is a question.
    assert.strictEqual(rows.at(-1).role, "assistant", `${label}: last row must be the answer`)
  }

  assertWellOrdered(await readBack(chatOld), "after repair")
  console.log("repaired: every turn now reads question then answer")

  // Idempotent: a second pass must change nothing.
  const snapshot = JSON.stringify(await readBack(chatOld))
  await c.unsafe(fs.readFileSync(MIGRATION, "utf8"))
  assert.strictEqual(JSON.stringify(await readBack(chatOld)), snapshot, "migration is not idempotent")
  console.log("idempotent: re-running the repair changed nothing")

  // --- the NEW route: answer derived from the question's own timestamp ----
  for (let i = 0; i < TURNS; i++) {
    const userCreatedAt = new Date()
    await c.unsafe(
      `insert into messages (chat_id, role, content, created_at) values ($1,'user',$2,$3)`,
      [chatNew, `question ${i}`, userCreatedAt]
    )
    const turnStartedAt = new Date(userCreatedAt.getTime() + 1)
    await c.unsafe(
      `insert into messages (chat_id, role, content, created_at) values ($1,'assistant',$2,$3)`,
      [chatNew, `answer ${i}`, turnStartedAt]
    )
    await sleep(5)
  }
  assertWellOrdered(await readBack(chatNew), "new write path")
  console.log("new write path: never inverted, no repair needed")

  // --- the live rows 0013 missed: parts behind another assistant row -------
  // Ten rows on live (2026-09-19/20) sat behind an ASSISTANT row -- a
  // multi-part turn -- with created_at minutes before the question and, in
  // one group, running backwards by id. 0013 matches an assistant row only
  // when its immediate predecessor is the user row, so it repairs the first
  // part and leaves the rest sorting above the question.
  const chatParts = "33333333-3333-3333-3333-333333333333"
  const asked = new Date()
  await c.unsafe(
    `insert into messages (chat_id, role, content, created_at) values ($1,'user',$2,$3)`,
    [chatParts, "question 0", asked]
  )
  for (const [n, minutesEarly] of [[0, 0], [1, 3], [2, 8]]) { // id ascends, time runs backwards
    await c.unsafe(
      `insert into messages (chat_id, role, content, created_at) values ($1,'assistant',$2,$3)`,
      [chatParts, `answer part ${n}`, new Date(asked.getTime() - minutesEarly * 60_000)]
    )
  }
  await c.unsafe(fs.readFileSync(MIGRATION, "utf8"))
  assert.notStrictEqual(
    (await readBack(chatParts))[0].role, "user",
    "0013 unexpectedly repaired parts that sit behind an assistant row"
  )
  await c.unsafe(fs.readFileSync(MIGRATION_PARTS, "utf8"))
  const parts = await readBack(chatParts)
  assert.deepStrictEqual(
    parts.map((r) => r.content),
    ["question 0", "answer part 0", "answer part 1", "answer part 2"],
    `0015 left the parts out of order: ${JSON.stringify(parts)}`
  )
  const partsSnapshot = JSON.stringify(parts)
  await c.unsafe(fs.readFileSync(MIGRATION_PARTS, "utf8"))
  assert.strictEqual(JSON.stringify(await readBack(chatParts)), partsSnapshot, "0015 is not idempotent")
  console.log("parts behind an assistant row: 0013 skipped them, 0015 repaired them, idempotent")

  await c.unsafe(`drop schema ${SCHEMA} cascade`)
  await c.end()
  console.log("\nPASS")
}

main().catch((err) => {
  console.error("\nFAIL:", err.message)
  process.exit(1)
})
