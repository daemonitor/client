import { IConnector } from "@daemonitor/common"

declare module "@daemonitor/client" {

    export class RestApiConnector implements IConnector {
        constructor(apiUrl: string, systemKey: string)

        sendData(data: any, type: string, uniqueId: string): Promise<void>
    }
}
