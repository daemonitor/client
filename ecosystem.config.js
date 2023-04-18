module.exports = {
    apps: [{
        name: "daemonitor-client",
        interpreter: "ts-node",
        script: "./daemonitor-client.ts",
        watch: true,
    }]
}
