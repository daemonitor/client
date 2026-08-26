// Enrollment: trade a single-use token for this system's durable key.
//
// The token comes from the dashboard and is baked into the install command, so
// the operator never copies a key by hand and never has a long-lived secret in
// their shell history. The claim payload also carries what the agent found on
// the box, which is how the server can name the system after its real hostname
// and enable the plugins that actually have something to monitor.

import { arch, hostname, platform, release, type as osType } from "os"
import { accessSync, constants } from "fs"
import { createConnection } from "net"
import { delimiter, join } from "path"

export interface EnrollmentResult {
  systemKey: string;
  systemId?: string;
  name?: string;
  config?: Record<string, any>;
}

/** Is `bin` executable somewhere on PATH? Cheaper than shelling out to which. */
const onPath = (bin: string): boolean => {
  const dirs = (process.env.PATH || "").split(delimiter).filter(Boolean)
  for (const dir of dirs) {
    try {
      accessSync(join(dir, bin), constants.X_OK)
      return true
    } catch {
      // Not here, keep looking.
    }
  }
  return false
}

const readable = (path: string): boolean => {
  try {
    accessSync(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

/** lxd listens on one of these depending on snap versus package install. */
const LXD_SOCKETS = [
  "/var/snap/lxd/common/lxd/unix.socket",
  "/var/lib/lxd/unix.socket",
]

/** Is something listening on localhost:port? Used to spot local databases. */
const listening = (port: number, timeoutMs = 300): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port })
    const done = (result: boolean) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(timeoutMs)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })

/**
 * Which plugins have something to monitor here. Advisory only: the server
 * decides what to enable, this just spares the operator from guessing.
 */
export async function detectPlugins(): Promise<string[]> {
  const found = ["os"]

  if (onPath("pm2")) found.push("pm2")
  // The binary alone isn't enough — without socket access the plugin sees
  // nothing, which looks like "Docker is broken" rather than "not permitted".
  if (onPath("docker") && readable("/var/run/docker.sock")) found.push("docker")
  // Same trap as docker: `lxc` is on PATH on plenty of boxes with no lxd
  // behind it, and enabling the plugin there just parks a dead entry in the
  // config. Require a socket to talk to.
  if (onPath("lxc") && LXD_SOCKETS.some(readable)) found.push("lxc")
  if (await listening(27017)) found.push("mongodb")

  return found
}

/** Stable per-machine id, so a reinstall re-attaches instead of duplicating. */
async function machineFingerprint(): Promise<string | undefined> {
  try {
    const mod: any = await import("node-machine-id")
    const fn = mod.machineIdSync || mod.default?.machineIdSync
    return typeof fn === "function" ? fn(true) : undefined
  } catch {
    // Optional metadata. Some containers have no machine-id file at all.
    return undefined
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * POST the token to /enroll/claim and return the credentials it hands back.
 *
 * Network failures retry with backoff, because an agent started at boot can
 * easily beat its own network stack. A rejected token does not retry: it is
 * expired, already used, or wrong, and none of those get better by waiting.
 */
export async function claim(
  token: string,
  endpoint: string,
  attempts = 5,
): Promise<EnrollmentResult> {
  const payload = {
    token,
    hostname: hostname(),
    machineId: await machineFingerprint(),
    detected: await detectPlugins(),
    agentVersion: process.env.npm_package_version || undefined,
    os: {
      type: osType(),
      name: platform(),
      version: release(),
      arch: arch(),
    },
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response
    try {
      res = await fetch(`${endpoint}/enroll/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    } catch (err: any) {
      lastError = new Error(`Could not reach ${endpoint}: ${err.message}`)
      if (attempt < attempts) await sleep(Math.min(2000 * attempt, 10000))
      continue
    }

    if (res.ok) {
      const body: any = await res.json()
      if (!body?.systemKey) throw new Error("Enrollment succeeded but returned no system key")
      return body as EnrollmentResult
    }

    const detail = await res.text().catch(() => "")
    const message = parseError(detail) || `HTTP ${res.status}`

    // 4xx means the token itself is the problem. Don't retry.
    if (res.status >= 400 && res.status < 500) {
      throw new Error(`Enrollment refused: ${message}`)
    }

    lastError = new Error(`Enrollment failed: ${message}`)
    if (attempt < attempts) await sleep(Math.min(2000 * attempt, 10000))
  }

  throw lastError || new Error("Enrollment failed")
}

/** Pull the message out of a Nitro error body, falling back to raw text. */
function parseError(body: string): string | null {
  try {
    const parsed = JSON.parse(body)
    return parsed.message || parsed.statusMessage || null
  } catch {
    return body ? body.slice(0, 200) : null
  }
}
