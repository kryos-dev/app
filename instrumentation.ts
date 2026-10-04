// Runs once per server boot, before the first request. Applies pending
// Drizzle migrations from ./drizzle so a fresh container needs no manual
// `db:migrate` step. Node runtime only (the edge runtime also calls register).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { db } = await import("./lib/db")
  const { migrate } = await import("drizzle-orm/postgres-js/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
}
