#!/usr/bin/env node

import * as dotenv from "dotenv"
import { hostname } from "os"
import { existsSync } from "fs"
import { join } from "path"
import { parseArgs, usage } from "./lib/args.js"
import {
  loadConfig,
  loadCredentials,
  normalizeEndpoint,
  saveConfig,
  saveCredentials,
} from "./lib/config.js"
import { claim } from "./lib/enroll.js"
import { installService, offerServiceInstall } from "./lib/service.js"
import { CONFIG_FILENAME, stateDir } from "./lib/paths.js"
import { agentVersion } from "./lib/version.js"

dotenv.config()

const AGENT_VERSION = agentVersion()

const NO_CREDENTIALS = `
No system key and no enrollment token.

Add a system in the dashboard, then run the command it gives you:

  daemonitor-client --token dmk_enroll_xxxxxxxx

If you already have a system key, pass it directly:

  daemonitor-client --key <system key>
`

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (opts.help) {
    console.log(usage())
    return
  }

  if (opts.version) {
    console.log(AGENT_VERSION)
    return
  }

  const endpoint = normalizeEndpoint(opts.endpoint)

  // Identity, in order of how explicit it is: the command line, then what a
  // previous enrollment stored, then a token to exchange for a new key.
  const stored = loadCredentials(opts.dir)
  let systemKey = opts.key || stored?.systemKey
  let enrolledConfig: Record<string, any> | undefined
  let justEnrolled = false

  if (!systemKey && opts.token) {
    console.log(`Enrolling ${hostname()} with ${endpoint}...`)

    const result = await claim(opts.token, endpoint)
    systemKey = result.systemKey
    enrolledConfig = result.config

    const credentialsPath = saveCredentials(
      {
        systemKey: result.systemKey,
        systemId: result.systemId,
        name: result.name,
        endpoint,
        enrolledAt: new Date().toISOString(),
      },
      opts.dir,
    )

    justEnrolled = true
    console.log(`Enrolled as "${result.name || hostname()}"`)
    console.log(`Credentials written to ${credentialsPath}`)
  }

  // Installing the unit is the whole job when asked for explicitly: systemd
  // starts its own copy, so running the monitor loop here too would double up.
  // This runs before the credential check on purpose. The unit only launches
  // the binary; whether a key is present is a question for the service user,
  // who gets the same message below if it is missing.
  if (opts.installService) {
    const result = installService()
    console.log(result.message)
    process.exit(result.ok ? 0 : 1)
  }

  if (!systemKey) {
    console.error(NO_CREDENTIALS.trim())
    process.exit(1)
  }

  // Otherwise, someone who just enrolled at a terminal almost certainly wants
  // this to outlive their shell.
  if (justEnrolled) await offerServiceInstall()

  // A config file on disk always wins over what enrollment returned: someone
  // who hand-edited it meant it. The server's config is only written when there
  // is nothing there to overwrite.
  let { config, source } = loadConfig(opts.config, opts.dir)

  if (enrolledConfig && source === "defaults") {
    const target = join(stateDir(opts.dir), CONFIG_FILENAME)
    if (!existsSync(target)) {
      saveConfig(enrolledConfig, opts.dir)
      console.log(`Config written to ${target}`)
    }
    config = enrolledConfig
    source = target
  }

  if (opts.plugins?.length) {
    config = { ...config, plugins: opts.plugins }
  }

  const plugins: string[] = config.plugins || []
  // The endpoint the credentials were minted against is the right default for
  // an agent started later with no --endpoint.
  const apiBaseUrl = opts.endpoint ? endpoint : normalizeEndpoint(stored?.endpoint)

  console.log(`daemonitor-client ${AGENT_VERSION} on ${hostname()}`)
  console.log(`  endpoint  ${apiBaseUrl}`)
  console.log(`  config    ${source}`)
  console.log(`  plugins   ${plugins.length ? plugins.join(", ") : "none"}`)

  // Imported here rather than at module load: it pulls in the whole plugin
  // manager, and --help and --version have no business paying for that.
  const { createDaemonitorClient } = await import("./lib/DaemonitorClient.js")

  const client = await createDaemonitorClient({
    ...config,
    plugins,
    systemKey,
    apiBaseUrl,
    apiUrl: `${apiBaseUrl}/clientstate/update`,
  })

  await client.start()
}

main().catch((error: any) => {
  // Startup failures are operator-facing. A stack trace here is noise: the
  // message says what to do about it.
  console.error(error?.message || error)
  process.exit(1)
})
