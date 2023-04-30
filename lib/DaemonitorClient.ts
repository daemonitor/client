import { PluginManager } from "@daemonitor/plugins"

import Connectors from "../connectors/index.js"

import * as dotenv from "dotenv"

dotenv.config()

interface DaemonitorClientConfig {
    plugins: any[]
    connectors: any[]
}

export class DaemonitorClient {

    connectors: any[] = []

    constructor(apiBaseUrl, apiUrl, systemKey, config: DaemonitorClientConfig) {

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

            // create and initialize the plugin manager
            const pluginManager = new PluginManager(config.plugins)
            await pluginManager.initialize()


            // initialize the connectors
            if (!config.connectors) {
                if (!process.env.SYSTEM_KEY) {
                    console.error("No SYSTEM_KEY environment variable found, exiting.")
                    process.exit(1)
                }
                config.connectors = [{
                    "type": "rest-api",
                    "name": "REST API",
                    "config": {
                        "apiUrl": "https://www.daemonitor.com/api/clientstate/update",
                        "systemKey": process.env.SYSTEM_KEY
                    }
                }]
            }
            for (const connectorItem of config.connectors) {
                if (!Connectors[connectorItem.type]) {
                    console.error(`Connector "${connectorItem.type}" not found.`)
                } else {
                    const connectorClass = Connectors[connectorItem.type]
                    const connector = new connectorClass(connectorItem.config)
                    this.connectors.push(connector)
                }
            }

            // inject the connectors into the plugin manager
            for (const connector of this.connectors) {
                await pluginManager.addConnector(connector)
            }


            // inject the API connection into the plugin manager

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
