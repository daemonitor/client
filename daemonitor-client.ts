#!/usr/bin/env node

import * as dotenv from "dotenv"
import { hostname } from "os"


import { readFileSync } from "fs"
import { DaemonitorClient } from "./lib/DaemonitorClient.js"

const config = JSON.parse(readFileSync("client.config.json", "utf8"))
dotenv.config()

const myHostname = hostname()
const systemKey = process.env.SYSTEM_KEY || "unknown"
const apiBaseUrl = process.env.API_BASE_URL || "http://daemonitor.com/api"
const apiUrl = `${apiBaseUrl}/clientstate/update`

console.log(`Starting for ${myHostname} with key ${systemKey}, using API at ${apiBaseUrl}`)


const client = new DaemonitorClient(apiBaseUrl, apiUrl, systemKey, config)
