#!/usr/bin/env node
// Mint an AdSense refresh token for the adsense plugin and write it, with the
// OAuth client id and secret, into an agent's client.config.json.
//
//   node etc/adsense-auth.mjs <client_secret.json> [ssh-host] [remote-config-path]
//
// <client_secret.json> is the file Google's "Download JSON" gives you for a
// Desktop-app OAuth client. With no ssh-host the values are merged into
// ./client.config.json; with one, into that host's config over ssh.
//
// Opens the consent page in the browser, catches Google's redirect on a
// loopback port, and trades the code for a refresh token. Nothing secret is
// printed, and the values travel to the remote host on stdin, never in argv.
//
// The consenting Google account must have access to the AdSense account. The
// OAuth app must be "In production" (or Internal): one left in Testing hands
// out refresh tokens that expire after 7 days.

import { createServer } from "node:http"
import { readFileSync, writeFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"

const [jsonPath, sshHost, remoteConfig = "daemonitor-src/client/client.config.json"] = process.argv.slice(2)
if (!jsonPath) {
  console.error("usage: node etc/adsense-auth.mjs <client_secret.json> [ssh-host] [remote-config-path]")
  process.exit(2)
}

const file = JSON.parse(readFileSync(jsonPath, "utf8"))
const client = file.installed || file.web
if (!client?.client_id || !client?.client_secret) throw new Error("not an OAuth client JSON (no installed/web client)")

const SCOPE = "https://www.googleapis.com/auth/adsense.readonly"

async function post(url, params) {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(params) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error_description || body.error || `HTTP ${res.status}`)
  return body
}

// Merge the three values into the config's `adsense` block, leaving the rest alone.
const MERGE = `
import json, sys
path = sys.argv[1]
vals = json.load(sys.stdin)
cfg = json.load(open(path))
cfg.setdefault("adsense", {"name": "AdSense", "uniqueId": "adsense", "refreshInterval": 600000}).update(vals)
open(path, "w").write(json.dumps(cfg, indent=2) + "\\n")
print("wrote adsense credentials to", path)
`

function writeConfig(vals) {
  if (!sshHost) {
    const path = "client.config.json"
    const cfg = JSON.parse(readFileSync(path, "utf8"))
    cfg.adsense = { name: "AdSense", uniqueId: "adsense", refreshInterval: 600000, ...cfg.adsense, ...vals }
    writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n")
    console.log("wrote adsense credentials to", path)
    return
  }
  // The python source goes in argv (it holds no secret); the values go on stdin.
  // Single-quoted for the remote shell: MERGE contains no single quotes.
  const r = spawnSync("ssh", [sshHost, `python3 -c '${MERGE}' '${remoteConfig}'`], {
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

    // Prove the token can see an AdSense account before saving it.
    const acc = await fetch("https://adsense.googleapis.com/v2/accounts", { headers: { Authorization: `Bearer ${tok.access_token}` } })
    const accounts = ((await acc.json().catch(() => ({}))).accounts || []).map((a) => `${a.displayName || ""} (${a.name})`)
    if (!acc.ok || !accounts.length) return done(`Signed in, but that Google account can see no AdSense account (HTTP ${acc.status}). Nothing was saved.`, 1)
    console.log("AdSense accounts visible to this token:", accounts.join(", "))

    writeConfig({ clientId: client.client_id, clientSecret: client.client_secret, refreshToken: tok.refresh_token })
    done("AdSense authorization saved.")
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
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
  })
  console.log("Opening the Google consent page. Choose the account that has AdSense access.\nIf no browser opens, visit:\n" + auth)
  // BROWSER_APP picks the browser, for when the right Google login is not in the default one.
  const app = process.env.BROWSER_APP
  spawn("open", app ? ["-a", app, auth] : [auth], { stdio: "ignore" })
})
