/** Normalised prefix test: `/a/b` contains `/a/b` and `/a/b/c`, not `/a/bc`. */
export function isUnder(path: string, root: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "")
  const p = norm(path)
  const r = norm(root)
  return p === r || p.startsWith(`${r}/`)
}
