// rest-api-connection.ts
import { $fetch } from "ohmyfetch"
import { IConnector } from "@daemonitor/common"

class RestApiConnector implements IConnector {
    constructor(private apiUrl: string, private systemKey: string) {
    }

    async sendData(data: any, type: string, uniqueId: string): Promise<void> {
        try {
            const opts = {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-System-Key": this.systemKey,
                    "X-Unique-Id": uniqueId,
                    "X-Type": type,
                },
                body: JSON.stringify(data),
            }
            await $fetch(this.apiUrl, opts).catch((err) => {
                console.error("Failed to send data to the remote server:", err, err.message)
            })
        } catch (error) {
            console.error("Failed to send data to the remote server:", error)
        }
    }
}

export default RestApiConnector
