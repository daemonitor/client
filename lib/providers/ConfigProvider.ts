import importedConfig from "~/config"

interface AppConfig {
    plugins: string[] | { [key: string]: any }[]
}

class ConfigProvider {
    private static config: AppConfig = importedConfig

    static async get(key: string): Promise<any> {
        if (!ConfigProvider.config[key]) {
            throw new Error(`Config key ${key} not found`)
        }
        return ConfigProvider.config[key]
    }

    // static async loadConfig(): Promise<void> {
    //     if (!ConfigProvider.config) {
    //         const configPath = path.join(__dirname, "config.json")
    //         return await fs.readFile(configPath, "utf8").then((data) => {
    //             ConfigProvider.config = JSON.parse(data)
    //         })
    //     }
    // }
}

export default ConfigProvider
