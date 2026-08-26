import { PluginManager } from "@daemonitor/plugins"
import { createConnector } from "../connectors/index.js"
import { IConnector } from "@daemonitor/common"
import * as dotenv from "dotenv"

dotenv.config()

// Define the client configuration interface
export interface DaemonitorClientConfig {
  plugins: string[];
  connectors?: Array<string | {
    type: string;
    name?: string;
    config?: any;
  }>;
  apiBaseUrl?: string;
  apiUrl?: string;
  systemKey?: string;
}

// Define the client instance interface
export interface DaemonitorClientInstance {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

// Factory function to create a daemonitor client
export async function createDaemonitorClient(config: DaemonitorClientConfig): Promise<DaemonitorClientInstance> {
  const connectors: IConnector[] = [];
  let pluginManagerInstance: any;
  
  // Validate configuration
  const systemKey = config.systemKey || process.env.SYSTEM_KEY;
  if (!systemKey) {
    throw new Error("No system key provided. Set SYSTEM_KEY environment variable or pass systemKey in config.");
  }
  
  const apiBaseUrl = config.apiBaseUrl || process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("No API base URL provided. Set API_BASE_URL environment variable or pass apiBaseUrl in config.");
  }
  
  // Validate plugins configuration
  if (!config.plugins || config.plugins.length === 0) {
    throw new Error("No plugins configured.");
  }
  
  // Initialize and start the client
  async function startClient() {
    try {
      // Initialize the plugin manager with the FULL config so per-plugin
      // config sections (config.docker, config.pm2, ...) are available to
      // plugins via PluginConfigProvider — not just the plugins list.
      pluginManagerInstance = PluginManager;
      await pluginManagerInstance.initialize(config as Record<string, any>);
      
      const restConfig = {
        apiUrl: config.apiUrl || `${apiBaseUrl}/clientstate/update`,
        systemKey
      };

      // Set up default connector if none provided
      if (!config.connectors || config.connectors.length === 0) {
        config.connectors = [{ type: "rest-api", name: "REST API", config: restConfig }];
      }

      // Accept the shorthand the docs have always shown (`"connectors": ["rest-api"]`)
      // alongside the long form. Either way the rest-api connector inherits the
      // resolved endpoint and key, so neither has to be repeated in the file.
      const connectorItems = config.connectors.map((item) => {
        const entry = typeof item === "string" ? { type: item, name: item, config: {} } : { ...item };
        if (entry.type === "rest-api") {
          entry.config = { ...restConfig, ...(entry.config || {}) };
        }
        return entry;
      });

      // Create and add connectors
      for (const connectorItem of connectorItems) {
        const connector = createConnector(connectorItem.type, connectorItem.config);
        if (connector) {
          connectors.push(connector);
          await pluginManagerInstance.addConnector(connector);
        }
      }
      
      // Start monitoring with all plugins
      await pluginManagerInstance.monitorAll();
      
      // Set up graceful shutdown
      process.on("SIGINT", async () => {
        console.log("SIGINT received, shutting down...");
        await pluginManagerInstance.teardownAll();
        process.exit(0);
      });
      
      console.log("Daemonitor client started successfully with plugins:", config.plugins.join(", "));
    } catch (error) {
      console.error("Failed to start Daemonitor client:", error);
      throw error;
    }
  }
  
  // Create the client instance
  const clientInstance: DaemonitorClientInstance = {
    start: startClient,
    stop: async () => {
      if (pluginManagerInstance) {
        await pluginManagerInstance.teardownAll();
        console.log("Daemonitor client stopped");
      }
    }
  };
  
  return clientInstance;
}
