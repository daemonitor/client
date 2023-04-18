import ConfigProvider from "./providers/ConfigProvider"
import PluginManager from "./PluginManager"

abstract class MonitoringPluginBase {
    static currentPluginIndex = 0
    protected alias: string
    protected name: string
    protected description: string
    protected instanceName: string
    protected refreshTimer: any
    protected uniqueId: string
    protected config: any
    protected pluginIndex: number

    protected constructor(alias: string, name: string, description: string) {
        this.pluginIndex = MonitoringPluginBase.currentPluginIndex++
        this.config = ConfigProvider.get(alias)
        this.name = name
        this.description = description
        this.instanceName = this.config.name || name
        this.uniqueId = this.config?.uniqueId || this.alias + "-" + this.pluginIndex
    }

    public async send(data: any, unique_id?: string): Promise<void> {
        for (const apiConnection of PluginManager.API_CONNECTIONS) {
            await apiConnection.sendData({name: this.instanceName, ...data}, this.name, unique_id || this.uniqueId)
        }
    }

    abstract setup(): Promise<void>;

    abstract monitor(): Promise<any>;

    abstract refresh(): Promise<void>;

    abstract teardown(): Promise<void>;

    getName() {
        return this.name
    }
}

export default MonitoringPluginBase
