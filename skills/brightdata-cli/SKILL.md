---
name: brightdata-cli
description: Guide for using the Bright Data CLI (`brightdata` / `bdata`) to scrape websites, search the web, extract structured data from 40+ platforms, manage proxy zones, and check account budget. Use this skill whenever the user wants to scrape a URL, search Google/Bing/Yandex, extract data from Amazon/LinkedIn/Instagram/TikTok/YouTube/Reddit or any other platform, check their Bright Data balance or zones, or do anything involving web data collection from the terminal. Also trigger when the user mentions brightdata, bdata, web scraping CLI, SERP API, or wants to install Bright Data skills into their coding agent.
---

# Bright Data CLI

The Bright Data CLI (`brightdata` or `bdata`) gives you full access to Bright Data's web data platform from the terminal. It handles authentication, proxy zones, anti-bot bypass, CAPTCHA solving, and JavaScript rendering automatically — the user just needs to log in once.

## First-Time Setup

Before anything else, check if the user is authenticated. If they haven't logged in yet, guide them through the one-time setup:

```bash
# One-time login — opens the browser for OAuth, then everything is automatic
brightdata login
```

This single command:
1. Opens the browser for secure OAuth authentication
2. Saves the API key locally (never needs to be entered again)
3. Auto-creates required proxy zones (`cli_unlocker`, `cli_browser`)
4. Sets default configuration

After login, every subsequent command works without any manual intervention.

For headless/SSH environments where no browser is available:
```bash
brightdata login --device
```

For direct API key authentication (non-interactive):
```bash
brightdata login --api-key <key>
```

To verify setup is complete, run:
```bash
brightdata config
```

## Command Reference

Read [references/commands.md](references/commands.md) for the full command reference with all flags, options, and examples for every command.

Read [references/pipelines.md](references/pipelines.md) for the complete list of 40+ pipeline types (Amazon, LinkedIn, Instagram, TikTok, YouTube, Reddit, and more) with their specific parameters.

## Quick Command Overview

| Command | Purpose |
|---------|---------|
| `brightdata scrape <url>` | Scrape any URL as markdown, HTML, JSON, or screenshot |
| `brightdata search "<query>"` | Search Google/Bing/Yandex with structured results |
| `brightdata pipelines <type> [params]` | Extract structured data from 40+ platforms |
| `brightdata status <job-id>` | Check async job status |
| `brightdata zones` | List proxy zones |
| `brightdata budget` | View account balance and costs |
| `brightdata skill add` | Install AI agent skills |
| `brightdata config` | View/set configuration |

## How to Use Each Command

### Scraping

Scrape any URL with automatic bot bypass, CAPTCHA handling, and JS rendering:

```bash
# Default: returns clean markdown
brightdata scrape https://example.com

# Get raw HTML
brightdata scrape https://example.com -f html

# Get structured JSON
brightdata scrape https://example.com -f json

# Take a screenshot
brightdata scrape https://example.com -f screenshot -o page.png

# Geo-targeted scrape from the US
brightdata scrape https://amazon.com --country us

# Save to file
brightdata scrape https://example.com -o page.md

# Async mode for heavy pages
brightdata scrape https://example.com --async
```

### Searching

Search engines with structured JSON output (Google returns parsed organic results, ads, People Also Ask, and related searches):

```bash
# Google search with formatted table
brightdata search "web scraping best practices"

# Get raw JSON for piping
brightdata search "typescript tutorials" --json

# Search Bing
brightdata search "bright data pricing" --engine bing

# Localized search
brightdata search "restaurants berlin" --country de --language de

# News search
brightdata search "AI regulation" --type news

# Extract just URLs
brightdata search "open source tools" --json | jq -r '.organic[].link'
```

### Pipelines (Structured Data Extraction)

Extract structured data from 40+ platforms. These trigger async jobs that poll until results are ready:

```bash
# LinkedIn profile
brightdata pipelines linkedin_person_profile "https://linkedin.com/in/username"

# Amazon product
brightdata pipelines amazon_product "https://amazon.com/dp/B09V3KXJPB"

# Instagram profile
brightdata pipelines instagram_profiles "https://instagram.com/username"

# Amazon search
brightdata pipelines amazon_product_search "laptop" "https://amazon.com"

# YouTube comments (top 50)
brightdata pipelines youtube_comments "https://youtube.com/watch?v=..." 50

# Google Maps reviews (last 7 days)
brightdata pipelines google_maps_reviews "https://maps.google.com/..." 7

# Output as CSV
brightdata pipelines amazon_product "https://amazon.com/dp/..." --format csv -o product.csv

# List all available pipeline types
brightdata pipelines list
```

### Checking Status

For async jobs (from `--async` scrapes or pipelines):

```bash
# Quick status check
brightdata status <job-id>

# Wait until complete
brightdata status <job-id> --wait

# With custom timeout
brightdata status <job-id> --wait --timeout 300
```

### Budget & Zones

```bash
# Quick account balance
brightdata budget

# Detailed balance with pending charges
brightdata budget balance

# All zones cost/bandwidth
brightdata budget zones

# Specific zone costs
brightdata budget zone my_zone

# Date range filter
brightdata budget zones --from 2024-01-01T00:00:00 --to 2024-02-01T00:00:00

# List all zones
brightdata zones

# Zone details
brightdata zones info cli_unlocker
```

### Configuration

```bash
# View all config
brightdata config

# Set defaults
brightdata config set default_zone_unlocker my_zone
brightdata config set default_format json
```

### Installing AI Agent Skills

```bash
# Interactive picker — choose skills and target agents
brightdata skill add

# Install a specific skill
brightdata skill add scrape

# List available skills
brightdata skill list
```

## Output Modes

Every command supports multiple output formats:

| Flag | Effect |
|------|--------|
| *(none)* | Human-readable formatted output with colors |
| `--json` | Compact JSON to stdout |
| `--pretty` | Indented JSON to stdout |
| `-o <path>` | Write to file (format auto-detected from extension) |

When piped (stdout is not a TTY), colors and spinners are automatically disabled.

## Chaining Commands

The CLI is pipe-friendly:

```bash
# Search → extract first URL → scrape it
brightdata search "top open source projects" --json \
  | jq -r '.organic[0].link' \
  | xargs brightdata scrape

# Scrape and view with markdown reader
brightdata scrape https://docs.github.com | glow -

# Amazon product data to CSV
brightdata pipelines amazon_product "https://amazon.com/dp/xxx" --format csv > product.csv
```

## Environment Variables

These override stored configuration:

| Variable | Purpose |
|----------|---------|
| `BRIGHTDATA_API_KEY` | API key (skips login entirely) |
| `BRIGHTDATA_UNLOCKER_ZONE` | Default Web Unlocker zone |
| `BRIGHTDATA_SERP_ZONE` | Default SERP zone |
| `BRIGHTDATA_POLLING_TIMEOUT` | Polling timeout in seconds |

## Troubleshooting

| Error | Fix |
|-------|-----|
| "No Web Unlocker zone specified" | `brightdata config set default_zone_unlocker <zone>` or re-run `brightdata login` |
| "Invalid or expired API key" | `brightdata login` |
| "Access denied" | Check zone permissions in the Bright Data control panel |
| "Rate limit exceeded" | Wait and retry, or use `--async` for large jobs |
| Async job timeout | Increase with `--timeout 1200` or `BRIGHTDATA_POLLING_TIMEOUT=1200` |

## Key Design Principles

- **One-time auth**: After `brightdata login`, everything is automatic. No tokens to manage, no keys to pass.
- **Zones auto-created**: Login creates `cli_unlocker` and `cli_browser` zones automatically.
- **Smart defaults**: Markdown output, auto-detected formats from file extensions, colors only in TTY.
- **Pipe-friendly**: JSON output + jq for automation. Colors/spinners disabled in pipes.
- **Async support**: Heavy jobs can run in background with `--async` + `status --wait`.
