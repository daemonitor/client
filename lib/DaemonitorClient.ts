import RestApiConnector from "../connectors/RestApiConnector.js"
import { PluginManager } from "@daemonitor/plugins"

export class DaemonitorClient {
    constructor(apiBaseUrl, apiUrl, systemKey, config) {

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
            const pluginsConfig = config.plugins
            if (!pluginsConfig) {
                console.error("No plugins configured, exiting.")
                process.exit(1)
            }

            // create the API connection
            const apiConnection = new RestApiConnector(apiUrl, systemKey)

            // create and initialize the plugin manager
            const pluginManager = new PluginManager(config.plugins)
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
    }
}
