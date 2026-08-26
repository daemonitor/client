// Export client factory and interfaces
export { 
  createDaemonitorClient,
  DaemonitorClientConfig,
  DaemonitorClientInstance
} from "./lib/DaemonitorClient.js"

// Export connector factories
export {
  createConnector,
  createConsoleConnector,
  createRestApiConnector,
  ConnectorFactories
} from "./connectors/index.js"
