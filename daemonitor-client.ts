#!/usr/bin/env node

import * as dotenv from "dotenv"
import { hostname } from "os"
import { readFileSync } from "fs"
import { createDaemonitorClient } from "./lib/DaemonitorClient"

// Load config and environment variables
const config = JSON.parse(readFileSync("client.config.json", "utf8"))
dotenv.config()

// Prepare configuration
const myHostname = hostname()
const systemKey = process.env.SYSTEM_KEY || "unknown"
const apiBaseUrl = process.env.API_BASE_URL || "http://daemonitor.com/api"
const apiUrl = `${apiBaseUrl}/clientstate/update`

console.log(`Starting for ${myHostname} with key ${systemKey}, using API at ${apiBaseUrl}`)

// Create and start the client
async function main() {
  try {
    const client = await createDaemonitorClient({
      ...config,
      systemKey,
      apiBaseUrl,
      apiUrl
    })
    
    await client.start()
  } catch (error) {
    console.error("Failed to start daemonitor client:", error)
    process.exit(1)
  }
}

main()
