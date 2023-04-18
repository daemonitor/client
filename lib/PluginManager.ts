import MonitoringPluginBase from "~/lib/MonitoringPluginBase"
import loadPlugins from "~/lib/PluginLoader"
import { IConnector } from "~/lib/interfaces/Connector"
import { stdout } from "process"

class PluginManager {

    static API_CONNECTIONS: IConnector[] = []
    private plugins: MonitoringPluginBase[]

    constructor() {

    }

    async initialize(): Promise<void> {
        return this.loadPlugins().then(
            () => this.setupAll()
        )
    }

    async loadPlugins(): Promise<void> {
        return await loadPlugins().then(plugins => {
            if (!plugins) {
                throw new Error("Failed to load plugins.")
            } else if (plugins.length === 0) {
                throw new Error("No plugins found.")
            } else {
                console.log(`Loaded ${plugins.length} plugins.`)
            }
            this.plugins = plugins
        })
    }

    async addApiConnection(apiConnection: IConnector): Promise<void> {
        PluginManager.API_CONNECTIONS.push(apiConnection)
    }

    async setupAll(): Promise<void> {
        if (!this.plugins) throw new Error("Plugins not loaded yet! Call loadPlugins() first.")
        for (const plugin of this.plugins) {
            await plugin.setup()
        }
    }

    async monitorAll(): Promise<any[]> {
        const results = []
        if (!this.plugins) throw new Error("Plugins not loaded yet! Call loadPlugins() first.")
        if (this.plugins.length === 0) throw new Error("No plugins loaded.")
        if (!PluginManager.API_CONNECTIONS || PluginManager.API_CONNECTIONS.length === 0)
            throw new Error("No API connections loaded yet! Call addApiConnection() first.")

        console.log(`Starting monitoring of ${this.plugins.length} plugins...`)
        for (const plugin of this.plugins) {
            stdout.write(`\r + ${plugin.getName()}`)
            const data = await plugin.monitor()
            results.push(data)
        }
        stdout.write("\n")

        return results
    }

    async teardownAll(): Promise<void> {
        for (const plugin of this.plugins) {
            await plugin.teardown()
        }
    }
}

export default PluginManager
