import { createConsoleConnector } from "./ConsoleConnector.js"
import { createRestApiConnector } from "./RestApiConnector.js"
import { IConnector } from "@daemonitor/common"

// Factory functions for creating connectors
export const ConnectorFactories: Record<string, (config: any) => IConnector> = {
  "console": createConsoleConnector,
  "rest-api": createRestApiConnector,
};

// Helper function to create a connector by type
export function createConnector(type: string, config: any): IConnector | null {
  if (!ConnectorFactories[type]) {
    console.error(`Connector type "${type}" not found.`);
    return null;
  }
  
  return ConnectorFactories[type](config);
}

// Export the factory functions directly
export { createConsoleConnector, createRestApiConnector }
