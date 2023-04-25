import { IConnector } from "@daemonitor/common"

export class ConsoleConnector implements IConnector {

    options: {
        verbose: boolean
    }

    constructor(options?: any) {
        console.log("ConsoleConnector constructor:", options)
        this.options = options

    }

    async sendData(data: any, type: string, uniqueId: string): Promise<void> {
        if(this.options.verbose) {
            console.log("Sending data to the remote server:", data, type, uniqueId)
        }else{
            console.log("sending", type, uniqueId)
        }
    }
}

