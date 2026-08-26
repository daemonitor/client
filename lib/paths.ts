// Where the agent keeps its credentials and its resolved config.
//
// Enrollment writes both files, so the directory has to be picked before the
// agent knows anything about itself. Order: an explicit --dir/DAEMONITOR_DIR
// wins, then /etc/daemonitor when we're root (the systemd unit's
// WorkingDirectory), then the per-user config dir, then the cwd as a last
// resort so an unprivileged `npx` run in a scratch directory still works.
import { homedir } from "os"
import { accessSync, constants, mkdirSync } from "fs"
import { dirname, join, resolve } from "path"

export const CONFIG_FILENAME = "client.config.json"
export const CREDENTIALS_FILENAME = "credentials.json"

const isRoot = (): boolean => typeof process.getuid === "function" && process.getuid() === 0

/** True when `path` exists and is writable, or when its parent is. */
const writable = (path: string): boolean => {
  try {
    accessSync(path, constants.W_OK)
    return true
  } catch {
    try {
      accessSync(dirname(path), constants.W_OK)
      return true
    } catch {
      return false
    }
  }
}

/**
 * The directory the agent reads and writes its own state in.
 * `explicit` is the --dir flag or DAEMONITOR_DIR.
 */
export function stateDir(explicit?: string): string {
  if (explicit) return resolve(explicit)

  if (isRoot() && writable("/etc/daemonitor")) return "/etc/daemonitor"

  const xdg = process.env.XDG_CONFIG_HOME
  const userDir = xdg ? join(xdg, "daemonitor") : join(homedir(), ".config", "daemonitor")
  if (writable(userDir)) return userDir

  return process.cwd()
}

/** Every directory the agent will look in for an existing config, best first. */
export function configSearchPaths(explicit?: string): string[] {
  const paths = [
    join(process.cwd(), CONFIG_FILENAME),
    join(stateDir(explicit), CONFIG_FILENAME),
    "/etc/daemonitor/" + CONFIG_FILENAME,
  ]
  // Dedupe: stateDir() can resolve to the cwd, and on a root install both the
  // stateDir and the hardcoded /etc path are the same file.
  return [...new Set(paths)]
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 })
}
