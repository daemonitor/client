import { networkInterfaces } from "os"
import MonitoringPluginBase from "~/lib/MonitoringPluginBase"

class OSPlugin extends MonitoringPluginBase {
    constructor() {
        super("os")
    }

    async setup(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                pm2.connect(async (err) => {
                    if (err) {
                        console.error(err)
                        reject(err)
                    } else {
                        resolve()
                    }
                })

            } catch (e) {
                console.error("ERROR", e)
                reject(e)
            }
        })
    }

    async refresh(): Promise<void> {
        const interfaces = networkInterfaces()
        const addresses: { [key: string]: { address: string, netmask: string, mac: string } } = {}
        for (let [key, value] of Object.entries(interfaces)) {
            if (value) {
                let found = value.find(port => ( port.family === "IPv4" ) && ( port.internal !== true ))
                if (found) {
                    let {address, netmask, mac} = found
                    addresses[key] = {address, netmask, mac}
                }
            }
        }

        const {totalmem, freemem, loadavg, uptime} = os
        const {hostname} = os
        const {platform, release, type, arch} = os
        const {cpus} = os


        await this.send({
            addresses,
            totalmem,
            freemem,
            loadavg,
            uptime,
            hostname,
            platform,
            release,
            type,
            arch,
            cpus
        })

    }

    async monitor(): Promise<any> {
        this.refreshTimer = setInterval(this.refresh.bind(this), this.config.refreshInterval || 5000)
    }

    async teardown(): Promise<void> {
        clearInterval(this.refreshTimer)
    }
}

export default PM2Plugin
