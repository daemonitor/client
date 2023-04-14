import * as pm2 from "pm2"
import { hostname, networkInterfaces } from "os"
import * as dotenv from "dotenv"
import { $fetch } from 'ohmyfetch'

dotenv.config()

const myHostname = hostname()
const systemKey = process.env.SYSTEM_KEY || "unknown"

const apiBaseUrl = process.env.API_BASE_URL === "production" ? "http://app.daemonitor.com/api" : "http://localhost:5678/api"
const apiURL = `${apiBaseUrl}/clientstate/update`

pm2.connect(function (err) {
    if (err) {
        console.error(err)
        process.exit(2)
    }

    setInterval(() => {
        const interfaces = networkInterfaces()
        let addresses: { [key: string]: { address: string, netmask: string, mac: string } } = {}
        for (let [key, value] of Object.entries(interfaces)) {
            if (value) {
                let found = value.find(port => ( port.family === "IPv4" ) && ( port.internal !== true ))
                if (found) {
                    let {address, netmask, mac} = found
                    addresses[key] = {address, netmask, mac}
                }
            }
        }

        pm2.list(async (err, list) => {
                if (!err) {
                    for (const p of list) {
                        let {
                            pid, name, pm_id, monit,
                            // exit_code,
                            // prev_restart_delay,
                            // versioning,
                            // axm_dynamic,
                            // axm_actions,
                            // merge_logs,
                            // vizion,
                            // instance_var,
                            // pmx,
                            // automation,
                            // treekill,
                            // windowsHide,
                            // kill_retry_time
                        } = p

                        let {
                            username,
                            watch,
                            axm_options,
                            axm_monitor,
                            node_version,
                            unique_id,
                            restart_time,
                            created_at,
                            unstable_restarts,
                            autorestart,
                            status,
                            pm_uptime
                        } = p.pm2_env as any

                        let res2 = {
                            unique_id,
                            systemKey,
                            data: {
                                updated: ( new Date() ).getTime(),
                                created_at,
                                unstable_restarts,
                                restarts: restart_time,
                                pid,
                                name,
                                pm_id,
                                monit,
                                username,
                                watch,
                                axm_options,
                                axm_monitor,
                                node_version,
                                unique_id,
                                restart_time,
                                autorestart,
                                status,
                                pm_uptime,
                                hostname: myHostname,
                                addrs: addresses
                            }
                        }

                        await $fetch(apiURL, {
                            method: "PUT",
                            body: JSON.stringify(res2)
                        })
                            .then(async (val) =>{
                                return await val.json()
                            })
                            .then((response) => {
                                if (response.success) {
                                    // console.log("success...")
                                } else {
                                    console.log("error...", response)
                                }
                            })
                            .catch((err) => {
                                console.log(err)
                            })
                    }
                } else {
                    console.error(err)
                }
            }
        )
    }, 5000)

// pm2.restart('api', (err, proc) => {
//     Disconnects from PM2
// pm2.disconnect()
// })
})
