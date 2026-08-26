// Command-line parsing for the agent.
//
// Every flag has an environment-variable equivalent so the same options work
// under systemd (EnvironmentFile) and in a container (-e). SYSTEM_KEY and
// API_BASE_URL are kept as aliases because deployed clients already set them.

export interface CliOptions {
  token?: string;
  key?: string;
  endpoint?: string;
  config?: string;
  dir?: string;
  plugins?: string[];
  installService: boolean;
  help: boolean;
  version: boolean;
}

const USAGE = `
daemonitor-client - monitoring agent

Usage:
  daemonitor-client [options]

Options:
  --token <token>     Enrollment token from the dashboard. Exchanged for a
                      system key on first run, then never needed again.
  --key <key>         System key, if you already have one. Skips enrollment.
  --endpoint <url>    API base URL (default: https://daemonitor.com/api)
  --config <path>     Path to client.config.json. Defaults to a search of the
                      working directory, the state directory, /etc/daemonitor.
  --dir <path>        State directory for credentials and config.
  --plugins <list>    Comma-separated plugin list, overriding the config file.
  --install-service   Install and start a systemd unit so the agent survives
                      reboots and disconnects. Needs root.
  -h, --help          Show this message.
  -v, --version       Print the agent version.

Environment:
  DAEMONITOR_TOKEN, DAEMONITOR_KEY (or SYSTEM_KEY),
  DAEMONITOR_ENDPOINT (or API_BASE_URL), DAEMONITOR_DIR

First run:
  daemonitor-client --token dmk_enroll_xxxxxxxx
`

const splitList = (value: string): string[] =>
  value.split(",").map((s) => s.trim()).filter(Boolean)

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { installService: false, help: false, version: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    // Accept both `--flag value` and `--flag=value`.
    const eq = arg.indexOf("=")
    const name = arg.startsWith("--") && eq > -1 ? arg.slice(0, eq) : arg
    const inline = arg.startsWith("--") && eq > -1 ? arg.slice(eq + 1) : undefined
    const next = () => {
      if (inline !== undefined) return inline
      const value = argv[++i]
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${name} needs a value`)
      }
      return value
    }

    switch (name) {
      case "--token": opts.token = next(); break
      case "--key": opts.key = next(); break
      case "--endpoint": opts.endpoint = next(); break
      case "--config": opts.config = next(); break
      case "--dir": opts.dir = next(); break
      case "--plugins": opts.plugins = splitList(next()); break
      case "--install-service": opts.installService = true; break
      case "-h": case "--help": opts.help = true; break
      case "-v": case "--version": opts.version = true; break
      default:
        if (name.startsWith("-")) throw new Error(`Unknown option: ${name}`)
    }
  }

  // Environment fills in whatever the command line did not set.
  opts.token = opts.token || process.env.DAEMONITOR_TOKEN || process.env.DAEMONITOR_ENROLL_TOKEN
  opts.key = opts.key || process.env.DAEMONITOR_KEY || process.env.SYSTEM_KEY
  opts.endpoint = opts.endpoint || process.env.DAEMONITOR_ENDPOINT || process.env.API_BASE_URL
  opts.dir = opts.dir || process.env.DAEMONITOR_DIR

  return opts
}

export function usage(): string {
  return USAGE.trimStart()
}
