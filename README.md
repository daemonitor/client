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
| origin | Optional direct-to-origin check (see below). | |

#### Origin (two-tiered checks)

For sites behind Cloudflare or another CDN, the public URL alone can't tell you the origin server is actually healthy — the CDN can keep serving cached content while the origin is down. Setting `origin` on an endpoint adds a second, direct-to-origin request alongside the public one; a failing origin surfaces as a warning even while the public site keeps serving fine.

| Option | Description | Default |
|--------|-------------|---------|
| url | The address that actually reaches the origin — its own hostname or IP, e.g. `https://origin.example.com/`. | |
| host | Overrides the `Host` header so the origin's vhost config routes the request as if it arrived on the public hostname, e.g. `www.example.com`. Equivalent to `curl -H "Host: ..."`. | |
| headers | Extra headers to send with the origin request (e.g. a bypass secret some origins require for direct, non-CDN traffic). | `{}` |
| query | Extra query params to append to the origin URL (e.g. `{ "cf": "1" }`, if that's what your origin/WAF checks for instead of a header). | `{}` |
| insecure | Skip TLS certificate verification on the origin request. Set this when Cloudflare (or the CDN) terminates TLS for you, so the origin's own certificate is self-signed, internal, or intentionally left expired — the origin check would otherwise fail on the cert even though the server is healthy. | `false` |
| timeout | Overrides the endpoint's own `timeout` for the origin request. | endpoint's `timeout` |
| expectedStrings / unexpectedStrings / expectedStatusCode | Override the endpoint's own values for evaluating the origin response. | endpoint's values |

Example — checking `www.archpaper.com` publicly, and directly against its origin (which only accepts direct traffic tagged with `?cf=1` and the public hostname in `Host`, and whose TLS cert isn't maintained because Cloudflare handles SSL):

```json
{
  "name": "archpaper.com",
  "url": "https://www.archpaper.com/",
  "origin": {
    "url": "https://origin.archpaper.com/",
    "host": "www.archpaper.com",
    "query": { "cf": "1" },
    "insecure": true
  }
}
```


### EWeLink

The EWeLink plugin provides information about EWeLink devices.

| Option | Description | Default |
|--------|-------------|---------|
| email  | EWeLink email address. | |
| password | EWeLink password. | |
| region | EWeLink region. | `us` |
| devices | An array of device IDs to monitor. | `[]` |

### Cloudflare

The Cloudflare plugin receives push updates from a Cloudflare Worker deployed in your Cloudflare account.

| Option | Description | Default |
|--------|-------------|---------|
| reportingKey | Unique reporting key for authenticating Cloudflare Worker updates. | |
| refreshInterval | Interval to check for stale data in milliseconds. | `60000` |
| maxDataAge | Maximum age of data before considering it stale in milliseconds. | `300000` (5 minutes) |

#### Push-Based Monitoring with Cloudflare Workers

Instead of polling the Cloudflare API directly, this plugin uses a push-based approach:

1. You deploy a Cloudflare Worker in your own Cloudflare account
2. The worker collects data about your deployments and zones on a schedule (e.g., every 5 minutes)
3. The worker pushes this data to Daemonitor using your unique reporting key
4. The Cloudflare plugin receives and displays this data in real-time

This approach provides several advantages:
- **Security**: Your Cloudflare API tokens remain within your Cloudflare account
- **Efficiency**: Eliminates polling and reduces network traffic
- **Customization**: You can modify what data is collected and reported
- **Reliability**: Worker runs on Cloudflare's edge network

#### Setting up the Cloudflare Worker

We provide a ready-to-deploy Cloudflare Worker template in the `/plugins/examples/cloudflare-worker` directory. 

Follow these steps to set it up:

1. Get your Daemonitor reporting key from your account settings
2. Deploy the worker to your Cloudflare account (see README in the example directory)
3. Configure the worker with your Cloudflare API token and Daemonitor reporting key
4. Set up a CRON trigger to run the worker on a schedule (e.g., every 5 minutes)
5. Configure the plugin in your client.config.json with your reporting key

For detailed instructions, see the README in the `/plugins/examples/cloudflare-worker` directory.


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
    

