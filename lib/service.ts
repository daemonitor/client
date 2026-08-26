// Installing the agent as a service.
//
// The agent has always been able to run, and then die with the SSH session
// that started it. The old answer was a unit file in the repo that the docs
// told people to copy by hand; it ran as root, never restarted, and pointed
// at a path that no longer existed. Since the agent knows where it is
// installed and which user it is running as, it can write a correct unit
// itself.

import { execFileSync } from "child_process"
import { existsSync, writeFileSync } from "fs"
import { userInfo } from "os"
import { createInterface } from "readline"

const UNIT_PATH = "/etc/systemd/system/daemonitor-client.service"

export const hasSystemd = (): boolean => existsSync("/run/systemd/system")

export const isRoot = (): boolean =>
  typeof process.getuid === "function" && process.getuid() === 0

export const serviceInstalled = (): boolean => existsSync(UNIT_PATH)

/**
 * The account the service should run as.
 *
 * Under sudo this is the human who invoked it, not root: the docker and lxc
 * plugins reach their sockets through group membership, and a root service
 * would also read its credentials from the wrong home directory.
 */
function serviceUser(): { user: string; home: string } {
  const sudoUser = process.env.SUDO_USER
  if (sudoUser && sudoUser !== "root") {
    try {
      const home = execFileSync("getent", ["passwd", sudoUser], { encoding: "utf8" })
        .trim()
        .split(":")[5]
      if (home) return { user: sudoUser, home }
    } catch {
      // getent missing or the user is not in passwd. Fall through.
    }
  }
  const info = userInfo()
  return { user: info.username, home: info.homedir }
}

/** Absolute path to the binary systemd should launch. */
function execStart(): string {
  // argv[1] is the resolved script when run through the bin shim, which is
  // what we want: a global install and a local one land in different places.
  const script = process.argv[1]
  if (script && existsSync(script)) return `${process.execPath} ${script}`
  return "/usr/bin/daemonitor-client"
}

export function unitFile(): string {
  const { user, home } = serviceUser()

  return `[Unit]
Description=daemonitor monitoring agent
Documentation=https://daemonitor.com/guide
# The agent pushes over the network, so wait for a routable address rather
# than just for the network stack to exist.
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${home}
ExecStart=${execStart()}
Restart=always
RestartSec=10
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
`
}

export interface InstallResult {
  ok: boolean;
  message: string;
}

export function installService(): InstallResult {
  if (process.platform !== "linux" || !hasSystemd()) {
    return {
      ok: false,
      message: "Service install needs systemd. Run the agent under your own process manager instead.",
    }
  }

  if (!isRoot()) {
    const args = process.argv.slice(2).filter((a) => a !== "--install-service")
    const rerun = ["sudo", execStart(), ...args, "--install-service"].join(" ")
    return {
      ok: false,
      message: `Installing a service needs root. Run:\n\n  ${rerun}\n`,
    }
  }

  try {
    writeFileSync(UNIT_PATH, unitFile(), { mode: 0o644 })
    execFileSync("systemctl", ["daemon-reload"], { stdio: "ignore" })
    execFileSync("systemctl", ["enable", "--now", "daemonitor-client"], { stdio: "ignore" })
  } catch (err: any) {
    return { ok: false, message: `Could not install the service: ${err.message}` }
  }

  return {
    ok: true,
    message: `Installed ${UNIT_PATH}, enabled and started.\n  Logs:   journalctl -u daemonitor-client -f\n  Status: systemctl status daemonitor-client`,
  }
}

/**
 * Ask whether to keep the agent running at boot.
 *
 * Only when someone is actually watching: a piped or scripted install must
 * never block on a prompt nobody can answer.
 */
export async function offerServiceInstall(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return
  if (process.platform !== "linux" || !hasSystemd() || serviceInstalled()) return

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer: string = await new Promise((resolve) =>
    rl.question("\nKeep this running at boot? [Y/n] ", resolve),
  )
  rl.close()

  if (/^n/i.test(answer.trim())) {
    console.log("Skipped. Install it later with: daemonitor-client --install-service")
    return
  }

  const result = installService()
  console.log(result.message)
  // Root already started the service, so this process would be a duplicate.
  if (result.ok) process.exit(0)
}
