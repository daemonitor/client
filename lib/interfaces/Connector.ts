export interface IConnector {
    sendData(data: any, type: string, uniqueId: string): Promise<void>;
}
