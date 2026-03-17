# Bright Data CLI — Full Command Reference

## Global Options

These flags work with any command:

| Flag | Description |
|------|-------------|
| `-k, --api-key <key>` | Override API key for this request |
| `--timing` | Show request timing info |
| `-v, --version` | Show CLI version |

---

## `brightdata login`

Authenticate with Bright Data. Opens the browser for OAuth by default.

| Flag | Description |
|------|-------------|
| `-k, --api-key <key>` | Use API key directly (skips browser) |
| `-c, --customer-id <id>` | Bright Data account ID (optional) |
| `-d, --device` | Use device flow for SSH/headless environments |

**What happens on login:**
1. Opens browser for OAuth (or uses device flow / direct API key)
2. Validates the API key
3. Saves credentials locally (`~/.config/brightdata-cli/credentials.json`)
4. Checks for required zones (`cli_unlocker`, `cli_browser`)
5. Creates missing zones automatically
6. Sets `cli_unlocker` as default zone if none configured

```bash
brightdata login                        # Browser OAuth (recommended)
brightdata login --device               # Headless/SSH environments
brightdata login --api-key <key>        # Direct API key
```

---

## `brightdata logout`

Clear stored credentials.

```bash
brightdata logout
```

---

## `brightdata scrape <url>`

Scrape any URL using Bright Data's Web Unlocker. Handles CAPTCHAs, JavaScript rendering, and anti-bot protections automatically.

| Flag | Description |
|------|-------------|
| `-f, --format <fmt>` | `markdown` (default), `html`, `screenshot`, `json` |
| `--country <code>` | ISO country code for geo-targeting (e.g. `us`, `de`, `jp`) |
| `--zone <name>` | Web Unlocker zone name |
| `--mobile` | Use a mobile user agent |
| `--async` | Submit async, return a snapshot ID |
| `-o, --output <path>` | Write output to file |
| `--json` | Force JSON output |
| `--pretty` | Pretty-print JSON output |

```bash
brightdata scrape https://news.ycombinator.com
brightdata scrape https://example.com -f html
brightdata scrape https://amazon.com -f json --country us -o product.json
brightdata scrape https://example.com -f screenshot -o page.png
brightdata scrape https://example.com --async
brightdata scrape https://docs.github.com | glow -
```

---

## `brightdata search <query>`

Search Google, Bing, or Yandex via Bright Data's SERP API.

Google returns structured JSON with: organic results, ads, People Also Ask, related searches.
Bing/Yandex return markdown by default.

| Flag | Description |
|------|-------------|
| `--engine <name>` | `google` (default), `bing`, `yandex` |
| `--country <code>` | Localized results (e.g. `us`, `de`) |
| `--language <code>` | Language code (e.g. `en`, `fr`) |
| `--page <n>` | Page number, 0-indexed (default: `0`) |
| `--type <type>` | `web` (default), `news`, `images`, `shopping` |
| `--device <type>` | `desktop`, `mobile` |
| `--zone <name>` | SERP zone name |
| `-o, --output <path>` | Write output to file |
| `--json` | Force JSON output |
| `--pretty` | Pretty-print JSON output |

```bash
brightdata search "typescript best practices"
brightdata search "restaurants berlin" --country de --language de
brightdata search "AI regulation" --type news
brightdata search "web scraping" --page 1
brightdata search "open source scraping" --json | jq -r '.organic[].link'
brightdata search "bright data pricing" --engine bing
```

---

## `brightdata pipelines <type> [params...] [options]`

Extract structured data from 40+ platforms. Triggers an async collection job, polls until ready, returns results.

| Flag | Description |
|------|-------------|
| `--format <fmt>` | `json` (default), `csv`, `ndjson`, `jsonl` |
| `--timeout <seconds>` | Polling timeout (default: `600`) |
| `-o, --output <path>` | Write output to file |
| `--json` | Force JSON output |
| `--pretty` | Pretty-print JSON output |

```bash
brightdata pipelines list                                           # List all types
brightdata pipelines linkedin_person_profile "https://linkedin.com/in/username"
brightdata pipelines amazon_product "https://amazon.com/dp/B09V3KXJPB" --format csv -o product.csv
brightdata pipelines instagram_profiles "https://instagram.com/username"
brightdata pipelines amazon_product_search "laptop" "https://amazon.com"
brightdata pipelines google_maps_reviews "https://maps.google.com/..." 7
brightdata pipelines youtube_comments "https://youtube.com/watch?v=..." 50
```

See [pipelines.md](pipelines.md) for the full list of types and their parameters.

---

## `brightdata status <job-id>`

Check status of an async snapshot job.

| Flag | Description |
|------|-------------|
| `--wait` | Poll until the job completes |
| `--timeout <seconds>` | Polling timeout (default: `600`) |
| `-o, --output <path>` | Write output to file |
| `--json` / `--pretty` | JSON output |

```bash
brightdata status s_abc123xyz
brightdata status s_abc123xyz --wait --pretty
brightdata status s_abc123xyz --wait --timeout 300
```

---

## `brightdata zones`

List and inspect Bright Data proxy zones.

```bash
brightdata zones                        # List all active zones
brightdata zones info <name>            # Full details for a zone
brightdata zones --json -o zones.json   # Export as JSON
brightdata zones info my_zone --pretty  # Pretty-print zone info
```

---

## `brightdata budget`

View account balance and per-zone cost/bandwidth. Read-only.

| Subcommand | Description |
|------------|-------------|
| *(none)* | Quick account balance |
| `balance` | Balance + pending charges |
| `zones` | Cost & bandwidth table for all zones |
| `zone <name>` | Detailed cost & bandwidth for one zone |

| Flag | Description |
|------|-------------|
| `--from <datetime>` | Start of date range (e.g. `2024-01-01T00:00:00`) |
| `--to <datetime>` | End of date range |
| `--json` / `--pretty` | JSON output |

```bash
brightdata budget
brightdata budget balance
brightdata budget zones
brightdata budget zone my_zone
brightdata budget zones --from 2024-01-01T00:00:00 --to 2024-02-01T00:00:00
```

---

## `brightdata config`

View and manage CLI configuration.

| Subcommand | Description |
|------------|-------------|
| *(none)* | Show all config |
| `get <key>` | Get a single value |
| `set <key> <value>` | Set a value |

| Config Key | Description |
|------------|-------------|
| `default_zone_unlocker` | Default zone for `scrape` and `search` |
| `default_zone_serp` | Override zone for `search` only |
| `default_format` | Default output format: `markdown` or `json` |
| `api_url` | Override API base URL |

```bash
brightdata config
brightdata config set default_zone_unlocker my_zone
brightdata config set default_format json
brightdata config get default_zone_unlocker
```

---

## `brightdata init`

Interactive setup wizard. Walks through authentication, zone selection, and default configuration.

| Flag | Description |
|------|-------------|
| `--skip-auth` | Skip the authentication step |
| `-k, --api-key <key>` | Provide API key directly |

```bash
brightdata init
```

---

## `brightdata skill`

Install Bright Data AI agent skills into coding agents (Claude Code, Cursor, Copilot, etc.).

| Subcommand | Description |
|------------|-------------|
| `add` | Interactive picker — choose skills + target agents |
| `add <name>` | Install a specific skill directly |
| `list` | List all available skills |

Available skills: `search`, `scrape`, `data-feeds`, `bright-data-mcp`, `bright-data-best-practices`

```bash
brightdata skill add              # Interactive
brightdata skill add scrape       # Direct install
brightdata skill list             # See what's available
```

---

## Configuration Storage

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/brightdata-cli/` |
| Linux | `~/.config/brightdata-cli/` |
| Windows | `%APPDATA%\brightdata-cli\` |

Two files:
- `credentials.json` — API key (mode 0o600)
- `config.json` — Zones, output format, preferences

Priority order: CLI flags > Environment variables > config.json > Defaults
