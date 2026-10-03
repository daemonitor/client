#!/usr/bin/env node
// Mint a Google refresh token for the adsense or ga4 plugin and write it, with
// the OAuth client id and secret, into an agent's client.config.json.
//
//   node etc/google-auth.mjs [--source=adsense|ga4] <client_secret.json> [ssh-host] [remote-config-path]
//
// --source picks the scope, the config block written and the check run before
// saving. It defaults to adsense.
//
// <client_secret.json> is the file Google's "Download JSON" gives you for a
// Desktop-app OAuth client. With no ssh-host the values are merged into
// ./client.config.json; with one, into that host's config over ssh.
//
// Opens the consent page in the browser, catches Google's redirect on a
// loopback port, and trades the code for a refresh token. Nothing secret is
// printed, and the values travel to the remote host on stdin, never in argv.
//
// The consenting Google account must have access to the AdSense account or the
// Analytics properties. The
// OAuth app must be "In production" (or Internal): one left in Testing hands
// out refresh tokens that expire after 7 days.

import { createServer } from "node:http"
import { readFileSync, writeFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"

const flags = process.argv.slice(2).filter((a) => a.startsWith("--"))
const [jsonPath, sshHost, remoteConfig = "daemonitor-src/client/client.config.json"] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const sourceName = (flags.find((f) => f.startsWith("--source=")) || "--source=adsense").split("=")[1]

// Per source: the scope to ask for, the config block to fill, and a call that
// proves the token can see something before it is saved.
const SOURCES = {
  adsense: {
    label: "AdSense",
    scope: "https://www.googleapis.com/auth/adsense.readonly",
    block: { name: "AdSense", uniqueId: "adsense", refreshInterval: 900000 },
    verifyUrl: "https://adsense.googleapis.com/v2/accounts",
    list: (body) => (body.accounts || []).map((a) => `${a.displayName || ""} (${a.name})`),
  },
  ga4: {
    label: "Google Analytics",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    block: { name: "Google Analytics", uniqueId: "ga4", refreshInterval: 900000 },
    verifyUrl: "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    list: (body) => (body.accountSummaries || []).map((a) => `${a.displayName || a.account} (${(a.propertySummaries || []).length} properties)`),
  },
}
const source = SOURCES[sourceName]
if (!jsonPath || !source) {
  console.error("usage: node etc/google-auth.mjs [--source=adsense|ga4] <client_secret.json> [ssh-host] [remote-config-path]")
  process.exit(2)
}

const file = JSON.parse(readFileSync(jsonPath, "utf8"))
const client = file.installed || file.web
if (!client?.client_id || !client?.client_secret) throw new Error("not an OAuth client JSON (no installed/web client)")

async function post(url, params) {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(params) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error_description || body.error || `HTTP ${res.status}`)
  return body
}

// Merge the three values into the source's config block, leaving the rest
// alone. argv carries the path, block key and defaults (no secrets); stdin
// carries the values.
const MERGE = `
import json, sys
path, key, defaults = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
vals = json.load(sys.stdin)
cfg = json.load(open(path))
cfg.setdefault(key, defaults).update(vals)
open(path, "w").write(json.dumps(cfg, indent=2) + "\\n")
print("wrote", key, "credentials to", path)
`

function writeConfig(vals) {
  if (!sshHost) {
    const path = "client.config.json"
    const cfg = JSON.parse(readFileSync(path, "utf8"))
    cfg[sourceName] = { ...source.block, ...cfg[sourceName], ...vals }
    writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n")
    console.log("wrote", sourceName, "credentials to", path)
    return
  }
  // The python source goes in argv (it holds no secret); the values go on stdin.
  // Single-quoted for the remote shell: MERGE contains no single quotes.
  const r = spawnSync("ssh", [sshHost, `python3 -c '${MERGE}' '${remoteConfig}' '${sourceName}' '${JSON.stringify(source.block)}'`], {
    input: JSON.stringify(vals),
    stdio: ["pipe", "inherit", "inherit"],
  })
  if (r.status !== 0) throw new Error(`ssh to ${sshHost} failed (exit ${r.status})`)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1")
  if (url.pathname !== "/") return res.writeHead(404).end()
  const done = (msg, code = 0) => {
    res.writeHead(200, { "Content-Type": "text/plain" }).end(`${msg}\nYou can close this tab.`)
    console.log(msg)
    server.close()
    process.exitCode = code
  }
  try {
    if (url.searchParams.get("error")) return done(`Google refused: ${url.searchParams.get("error")}`, 1)
    const tok = await post("https://oauth2.googleapis.com/token", {
      grant_type: "authorization_code",
      code: url.searchParams.get("code") || "",
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirect,
    })
    if (!tok.refresh_token) return done("Google returned no refresh token. Remove the app's access at myaccount.google.com/permissions and run this again.", 1)

    // Prove the token can see something before saving it.
    const acc = await fetch(source.verifyUrl, { headers: { Authorization: `Bearer ${tok.access_token}` } })
    const accounts = source.list(await acc.json().catch(() => ({})))
    if (!acc.ok || !accounts.length) return done(`Signed in, but that Google account can see no ${source.label} account (HTTP ${acc.status}). Nothing was saved.`, 1)
    console.log(`${source.label} accounts visible to this token:`, accounts.join(", "))

    writeConfig({ clientId: client.client_id, clientSecret: client.client_secret, refreshToken: tok.refresh_token })
    done(`${source.label} authorization saved.`)
  } catch (e) {
    done(`Failed: ${e.message}`, 1)
  }
})

let redirect = ""
server.listen(0, "127.0.0.1", () => {
  redirect = `http://127.0.0.1:${server.address().port}`
  const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirect,
    response_type: "code",
    scope: source.scope,
    access_type: "offline",
    prompt: "consent select_account",
  })
  console.log(`Opening the Google consent page. Choose the account that has ${source.label} access.\nIf no browser opens, visit:\n` + auth)
  // BROWSER_APP picks the browser, for when the right Google login is not in the default one.
  const app = process.env.BROWSER_APP
  spawn("open", app ? ["-a", app, auth] : [auth], { stdio: "ignore" })
})
