import { IConnector } from "@daemonitor/common";

// Export interfaces for client configuration
export interface DaemonitorClientConfig {
  plugins: string[];
  connectors?: Array<{
    type: string;
    name: string;
    config: any;
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

// Connector factory types
export type ConnectorFactory = (config: any) => IConnector;
export interface ConnectorFactoryRecord {
  [key: string]: ConnectorFactory;
}

// Console connector options
export interface ConsoleConnectorOptions {
  verbose?: boolean;
}

// REST API connector options
export interface RestApiConnectorOptions {
  apiUrl: string;
  systemKey: string;
}