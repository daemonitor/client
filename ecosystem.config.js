module.exports = {
    apps: [
        {
            name: "daemonitor-client",
            script: "./daemonitor-client.js",
            watch: true,
            instance_var: 'INSTANCE_ID',
            env: {
                "PORT": 3000,
                "NODE_ENV": "production"
            }
        }
    ]
}