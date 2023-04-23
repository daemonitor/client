import * as dotenv from "dotenv"
import { hostname } from "os"
import { PluginManager } from "@daemonitor/plugins"
import { AppConfigProvider } from "@daemonitor/common"
import RestApiConnector from "~/connectors/RestApiConnector.js"

dotenv.config()

const myHostname = hostname()
const systemKey = process.env.SYSTEM_KEY || "unknown"
const apiBaseUrl = process.env.API_BASE_URL || "http://daemonitor.com/api"
const apiUrl = `${apiBaseUrl}/clientstate/update`

console.log(`Starting for ${myHostname} with key ${systemKey}, using API at ${apiBaseUrl}`);

( async () => {

    if (!systemKey) {
        console.error("No system key provided, exiting.")
        process.exit(1)
    }

    if (!apiBaseUrl) {
        console.error("No API base URL provided, exiting.")
        process.exit(1)
    }

    // load the plugins configuration
    const pluginsConfig = await AppConfigProvider.get("plugins")
    if (!pluginsConfig) {
        console.error("No plugins configured, exiting.")
        process.exit(1)
    }

    // create the API connection
    const apiConnection = new RestApiConnector(apiUrl, systemKey)

    // create and initialize the plugin manager
    const pluginManager = new PluginManager()
    await pluginManager.initialize()

    // inject the API connection into the plugin manager
    await pluginManager.addApiConnection(apiConnection)

    await pluginManager.monitorAll()


    // listen for interrupts and shutdown gracefully
    process.on("SIGINT", async () => {
        console.log("SIGINT received, shutting down...")
        await pluginManager.teardownAll()
        process.exit(0)
    })
} )()

export const DaemonitorClient = {}
