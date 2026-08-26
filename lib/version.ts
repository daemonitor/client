// The agent's own version, read from package.json rather than duplicated in a
// constant. Releases here are cut with `pnpm version`, which rewrites
// package.json and nothing else, so a hardcoded copy drifts on the first bump.

import { readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

export function agentVersion(): string {
  // This file sits at dist/lib/ when built and lib/ when run from source, so
  // walk up rather than hardcoding a depth that only holds in one of them.
  let dir = dirname(fileURLToPath(import.meta.url))

  for (let i = 0; i < 4; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
      if (pkg?.name === "@daemonitor/client" && pkg.version) return pkg.version
    } catch {
      // No package.json here, or not ours. Keep climbing.
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return "unknown"
}
