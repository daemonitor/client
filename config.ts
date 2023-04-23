export default {
    plugins: [
        "pm2",
        "os",
        "web"
    ],
    pm2: {
        name: "pm2",
        uniqueId: "pm2",
        refreshInterval: 10000
    },
    web: {
        endpoints: [
            {"name": "L422Y.COM", "url": "https://l422y.com", expectedStrings: ["l422y"]},
            {"name": "CITYRFP STAGE", "url": "https://stage.cityrfp.com", unexpectedStrings: ["Bad Gateway"]},
        ]
    }
}
