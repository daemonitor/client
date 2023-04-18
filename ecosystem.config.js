module.exports = {
    apps: [{
        name: "daemonitor-client",
        interpreter: "none",
        script: "ts-node ./daemonitor-client.ts",
        watch: true,
    }]
}
