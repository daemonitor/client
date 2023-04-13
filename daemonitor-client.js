import pm2 from "pm2"
import os from "os"
import dotenv from "dotenv"

dotenv.config()

const hostname = os.hostname()
const machineId = process.env.MACHINE_ID || "unknown"

const apiBaseUrl = process.env.API_BASE_URL === "production" ? "http://app.daemonitor.com/api" : "http://localhost:5678/api"
const apiURL = `${apiBaseUrl}/clientstate/update`

pm2.connect(function (err) {
    if (err) {
        console.error(err)
        process.exit(2)
    }

    setInterval(() => {
        const ifaces = os.networkInterfaces()
        let addrs = {}
        for (let [key, value] of Object.entries(ifaces)) {
            let found = value.find(port => (port.family === "IPv4") && (port.internal !== true))
            if (found) {
                let {address, netmask, mac} = found
                addrs[key] = {address, netmask, mac}
            }
        }

        pm2.list(async (err, list) => {
                if (!err) {
                    for (const p of list) {
                        let {
                            pid, name, pm_id, monit,
                            exit_code,
                            prev_restart_delay,
                            versioning,
                            axm_dynamic,
                            axm_actions,
                            merge_logs,
                            vizion,
                            instance_var,
                            pmx,
                            automation,
                            treekill,
                            windowsHide,
                            kill_retry_time
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
                        } = p.pm2_env

                        let res2 = {
                            unique_id,
                            data: {
                                updated: (new Date()).getTime(),
                                machineId,
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
                                hostname,
                                addrs
                            }
                        }

                        console.log(apiURL, JSON.stringify(res2))

                        await fetch(apiURL, {
                            method: "PUT",
                            body: JSON.stringify(res2)
                        })
                            .then(async (val) => val.json())
                            .then((response) => {
                                if (response.success) {
                                    console.log("success...")
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
