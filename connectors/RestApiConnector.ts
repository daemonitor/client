import { IConnector } from "@daemonitor/common"

// Define interface for rest api connector options
export interface RestApiConnectorOptions {
  apiUrl: string;
  systemKey: string;
}

/** Give up on a push well before the next one is due. */
const REQUEST_TIMEOUT_MS = 15000

// Factory function to create a REST API connector
export function createRestApiConnector(options: RestApiConnectorOptions): IConnector {
  const { apiUrl, systemKey } = options;

  console.log("Creating RestApiConnector:", apiUrl);

  // Return the connector implementation
  return {
    sendData: async (data: any, type: string, uniqueId: string): Promise<void> => {
      try {
        const res = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-System-Key": systemKey,
            "X-Unique-Id": uniqueId,
            "X-Type": type,
          },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (res.ok) return;

        // A rejected key is not a transient failure and will not fix itself.
        // Saying so once per push beats "Failed to send data" forever, which is
        // what this looked like when a system was deleted server-side.
        if (res.status === 404) {
          console.error(
            `Server does not recognize this system key (404). It may have been deleted or the agent may need to re-enroll.`,
          );
          return;
        }

        const detail = await res.text().catch(() => "");
        console.error(`Failed to send ${type} data: HTTP ${res.status} ${detail.slice(0, 200)}`);
      } catch (error: any) {
        // Timeouts and DNS/connection failures land here. The next tick retries.
        console.error(`Failed to send ${type} data to the remote server:`, error?.message || error);
      }
    }
  };
}
