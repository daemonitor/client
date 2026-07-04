// rest-api-connection.ts
import { $fetch } from "ohmyfetch"
import { IConnector } from "@daemonitor/common"

// Define interface for rest api connector options
export interface RestApiConnectorOptions {
  apiUrl: string;
  systemKey: string;
}

// Factory function to create a REST API connector
export function createRestApiConnector(options: RestApiConnectorOptions): IConnector {
  const { apiUrl, systemKey } = options;
  
  console.log("Creating RestApiConnector:", apiUrl);
  
  // Return the connector implementation
  return {
    sendData: async (data: any, type: string, uniqueId: string): Promise<void> => {
      try {
        const opts = {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-System-Key": systemKey,
            "X-Unique-Id": uniqueId,
            "X-Type": type,
          },
          body: JSON.stringify(data),
        };
        
        await $fetch(apiUrl, opts).catch((err) => {
          console.error("Failed to send data to the remote server:", err, err.message);
        });
      } catch (error) {
        console.error("Failed to send data to the remote server:", error);
      }
    }
  };
}

