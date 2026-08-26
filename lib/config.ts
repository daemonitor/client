// Config and credential resolution.
//
// The agent used to read ./client.config.json unconditionally and crash with an
// unhandled ENOENT when it wasn't there, which made `npx @daemonitor/client`
// impossible on a fresh machine. Nothing here throws for a missing file: a
// config is optional, and an agent with only a key and an endpoint runs the OS
// plugin.

import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import {
  CONFIG_FILENAME,
  CREDENTIALS_FILENAME,
  configSearchPaths,
  ensureDir,
  stateDir,
} from "./paths.js"

export const DEFAULT_ENDPOINT = "https://daemonitor.com/api"

/** What enrollment persists: the durable identity of this agent. */
export interface Credentials {
  systemKey: string;
  systemId?: string;
  name?: string;
  endpoint?: string;
  enrolledAt?: string;
}

export interface ResolvedConfig {
  config: Record<string, any>;
  /** Where the config came from, for the startup banner. */
  source: string;
}

const readJson = (path: string): any | null => {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (err: any) {
    // A missing file is the normal case on a fresh install. A malformed one is
    // not, and silently falling through to defaults would be worse than saying
    // so, so it's surfaced and then skipped.
    if (err?.code !== "ENOENT") {
      console.warn(`Ignoring ${path}: ${err.message}`)
    }
    return null
  }
}

/** The config the agent runs with, falling back to a single OS plugin. */
export function loadConfig(explicitPath?: string, dir?: string): ResolvedConfig {
  if (explicitPath) {
    const config = readJson(explicitPath)
    // An explicit --config that doesn't parse IS fatal: the user named a file
    // and expects it to be used, so quietly running defaults would be a lie.
    if (!config) throw new Error(`Could not read config file: ${explicitPath}`)
    return { config, source: explicitPath }
  }

  for (const path of configSearchPaths(dir)) {
    const config = readJson(path)
    if (config) return { config, source: path }
  }

  return { config: { plugins: ["os"] }, source: "defaults" }
}

export function loadCredentials(dir?: string): Credentials | null {
  const creds = readJson(join(stateDir(dir), CREDENTIALS_FILENAME))
  return creds?.systemKey ? (creds as Credentials) : null
}

export function saveCredentials(creds: Credentials, dir?: string): string {
  const target = stateDir(dir)
  ensureDir(target)
  const path = join(target, CREDENTIALS_FILENAME)
  // 0600: this file holds the ingest credential.
  writeFileSync(path, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 })
  return path
}

export function saveConfig(config: Record<string, any>, dir?: string): string {
  const target = stateDir(dir)
  ensureDir(target)
  const path = join(target, CONFIG_FILENAME)
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", { mode: 0o644 })
  return path
}

/** Normalize whatever the user gave us into a base URL with no trailing slash. */
export function normalizeEndpoint(endpoint?: string): string {
  const value = (endpoint || DEFAULT_ENDPOINT).trim().replace(/\/+$/, "")
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}
