import * as fs from "fs/promises"
import * as path from "path"
import MonitoringPluginBase from "./MonitoringPluginBase"

async function loadPlugins(): Promise<MonitoringPluginBase[]> {
    const pluginsPath = path.join(__dirname, "../plugins")
    const pluginFiles = ( await fs.readdir(pluginsPath) ).filter(file => /\.ts$/.test(file))
    const plugins: MonitoringPluginBase[] = []

    for (const file of pluginFiles) {
        const pluginPath = path.join(pluginsPath, file)
        const pluginModulePath = path.relative(__dirname, pluginPath).replace(/\.ts$/, "")

        console.log(`Loading plugin from "${pluginPath}"...`)

        try {
            const module = await import(pluginModulePath)
            const PluginClass = module.default
            const pluginInstance = new PluginClass()
            plugins.push(pluginInstance)
        } catch (error) {
            console.error(`Failed to load plugin from "${pluginPath}":`, error)
        }
    }

    return plugins
}

export default loadPlugins
