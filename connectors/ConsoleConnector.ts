import { IConnector } from "@daemonitor/common"

// Define the interface for connector options
export interface ConsoleConnectorOptions {
  verbose?: boolean;
}

// Factory function to create a console connector
export function createConsoleConnector(options: ConsoleConnectorOptions = {}): IConnector {
  console.log("Creating ConsoleConnector:", options);
  
  // Return the connector implementation
  return {
    sendData: async (data: any, type: string, uniqueId: string): Promise<void> => {
      if (options.verbose) {
        console.log("Sending data to the remote server:", data, type, uniqueId);
      } else {
        console.log("sending", type, uniqueId);
      }
    }
  };
}

