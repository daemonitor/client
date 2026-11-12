import { IConnector } from "@daemonitor/common"

// Define interface for rest api connector options
export interface RestApiConnectorOptions {
  apiUrl: string;
  systemKey: string;
}

/** Give up on a push well before the next one is due. */
const REQUEST_TIMEOUT_MS = 15000

// Factory function to create a REST API connector
export function createRestApiConnector(options: RestApiConnectorOptions): IConnector & { sendFrame(uniqueId: string, jpeg: Uint8Array): Promise<void> } {
  const { apiUrl, systemKey } = options;

  console.log("Creating RestApiConnector:", apiUrl);

  // Camera frames go beside reports, on the same tenant.
  const frameUrl = /\/clientstate\/update\/?$/.test(apiUrl)
    ? apiUrl.replace(/\/clientstate\/update\/?$/, "/camera/frame")
    : new URL("/api/camera/frame", apiUrl).href;
  let frameErrorLogged = "";

  // Return the connector implementation
  return {
    /** One camera's latest JPEG. Logs a failure once until it changes, since frames come every few seconds. */
    sendFrame: async (uniqueId: string, jpeg: Uint8Array): Promise<void> => {
      let problem = "";
      try {
        const res = await fetch(frameUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg", "X-System-Key": systemKey, "X-Unique-Id": uniqueId },
          body: jpeg as unknown as BodyInit,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!res.ok) problem = `HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`;
      } catch (error: any) {
        problem = error?.message || String(error);
      }
      if (problem && problem !== frameErrorLogged) console.error(`Failed to send frame for ${uniqueId}: ${problem}`);
      frameErrorLogged = problem;
    },
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
