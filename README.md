# Daemonitor Client

This is the client for Daemonitor. It can be used to monitor your devices and send events to the Daemonitor server.


## Run with PM2:

Clone the repository and install dependencies:

```shell
git clone https://github.com/daemonitor/client.git
cd client 
pnpm install
```

Setup your `client.config.json` and `.env` files:

```shell
cp client.config.json.example client.config.json
cp .env.example .env
```

Start the client with PM2:

```shell
pm2 start npm --name daemonitor-client -- run start
```

## Install as a service using systemd

Note: you will not be able to use the PM2 monitoring plugin if you install as a service.

Setup your configuration file at `/etc/daemonitor/client.config.json`

```shell
sudo cp client.config.json.example /etc/daemonitor/client.config.json
sudo cp .env.example /etc/daemonitor/.env
```

Install the package globally:

```shell
sudo npm install -g @daemonitor/client
```

You should now be able to run the client from the command line:

```shell
daemonitor-client
```

Install the service:

```shell
sudo cp daemonitor-client.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable daemonitor-client
sudo systemctl start daemonitor-client
```

## Configuration

The client can be configured using the `client.config.json` file. The following options are available:

| Option         | Description                          | Options                           |
|----------------|--------------------------------------|-----------------------------------|
| connectors     | An array of connectors to load.      | `["rest-api", "console"]`         |
| plugins        | An array of plugins to load.         | `["os", "pm2", "ewelink", "web"]` |
| [plugin alias] | An object of options for the plugin. | See plugin documentation.         |


## Plugins

### OS

The OS plugin provides information about the operating system.


### PM2

The PM2 plugin provides information about PM2 processes.

| Option | Description | Default |
|--------|-------------|---------|
| processes | An array of process names to monitor. | `[]` |

### Web

The Web plugin provides information about web services.

| Option | Description | Default |
|--------|-------------|---------|
| endpoints | An array of endpoints to monitor. | `[]` |


Endpoints can be configured with the following options:

| Option | Description | Default |
|--------|-------------|---------|
| name | The name of the endpoint. | |
| url | The URL of the endpoint. | |
| method | The HTTP method to use. | `GET` |
| headers | An object of headers to send. | `{}` |
| body | The body to send. | |
| interval | The interval to poll the endpoint. | `60000` |
| timeout | The timeout for the request. | `5000` |
| expectedStrings | An array of strings that should be present in the response. | `[]` |
| expectedStatusCode | The expected status code. | `200` |
| unexpectedStrings | An array of strings that should not be present in the response. | `[]` |
| unexpectedStatusCode | The unexpected status code. | `200` |
| expectedResponseTime | The expected response time. | `1000` |
| unexpectedResponseTime | The unexpected response time. | `1000` |
| expectedResponseSize | The expected response size. | `0` |
| unexpectedResponseSize | The unexpected response size. | `0` |


### EWeLink

The EWeLink plugin provides information about EWeLink devices.

| Option | Description | Default |
|--------|-------------|---------|
| email  | EWeLink email address. | |
| password | EWeLink password. | |
| region | EWeLink region. | `us` |
| devices | An array of device IDs to monitor. | `[]` |


## Connectors

### Console

The Console connector logs events to the console.

| Option | Description | Default |
|--------|-------------|---------|
| level | The minimum log level to log. | `info` |

### REST API
    
The REST API connector sends events to a REST API.

| Option | Description | Default |
|--------|-------------|---------|
| url | The URL of the REST API. | |
| token | The token to use for authentication. | |
| level | The minimum log level to log. | `info` |
| interval | The interval to send events. | `10000` |
| timeout | The timeout for the request. | `5000` |
| maxRetries | The maximum number of retries. | `3` |
| retryDelay | The delay between retries. | `1000` |
| retryBackoff | The backoff factor for retries. | `2` |
| retryJitter | The jitter factor for retries. | `0` |
    

