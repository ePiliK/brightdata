# Company Intelligence Platform

**Company Intelligence Platform** is a live web research app built for the Bright Data hackathon.

It lets a user enter **one company name** such as `Apple` or `Notion`, choose what they want to learn, and run a live Bright Data-powered analysis. The app can infer competitors automatically, collect evidence from search and official pages, and turn that into a usable intelligence report.

This is not a static mockup and it does not rely on model memory. The app runs against the **live web** every time.

---

## What it does

The platform supports multiple research modes:

- `market` — positioning, pricing, product messaging, competitor pages
- `reviews` — comparisons, complaints, review-style coverage, reputation
- `social` — social visibility and public presence signals
- `hiring` — careers pages and org growth signals
- `financial` — stock, market cap, earnings, and investor-oriented evidence when available

For each run, it:

1. discovers likely competitors if the user enters a single company
2. searches the web with Bright Data for relevant live results
3. finds official pages like homepage, pricing, blog, careers
4. scrapes those pages through Bright Data Web Unlocker
5. extracts structured signals from the collected content
6. renders a report in the browser with charts, findings, sources, and downloadable output

---

## Why Bright Data matters

Bright Data is not just a convenience layer here. It is the core of the product.

| Bright Data capability | How the app uses it |
|---|---|
| `discover` | find relevant URLs and entity-adjacent pages from live web intent |
| `search` / SERP | gather Google context, comparisons, reviews, news, hiring clues |
| Web Unlocker scraping | extract markdown from official sites that are JS-heavy or bot-protected |
| CLI auth and routing | lets the app run with real account-backed Bright Data access |

Without Bright Data, this platform would either miss the right sources, fail on dynamic sites, or degrade into a static demo.

---

## Bright Data source routing

| Research mode | Primary domains | Bright Data tools / pipelines | Support |
|---|---|---|---|
| `market` | google.com, official sites, linkedin.com, crunchbase.com | `bdata search`, Web Unlocker scrape, `linkedin_company_profile`, `crunchbase_company` | **Strong** |
| `reviews` | google.com, reddit.com, g2.com, capterra.com | `bdata search`, Web Unlocker scrape, review-oriented SERP | **Strong** |
| `social` | linkedin.com, x.com, youtube.com | `bdata search`, `linkedin_posts`, `x_posts`, `youtube_profiles` | **Strong** |
| `hiring` | linkedin.com, glassdoor.com, careers pages | `bdata search`, `linkedin_company_profile`, `linkedin_job_listings` | **Strong** |
| `financial` | finance.yahoo.com, investor pages | `bdata search`, `yahoo_finance_business`, finance SERP | **Partial** |

The app picks pipelines when matching URLs appear in live SERP results. Financial mode is useful for evidence gathering but is not a full market terminal yet.

---

## Product shape

The app is intentionally structured like a real company intelligence workspace:

- an **informative home page** with product overview and a sticky CTA
- a dedicated **`/search` page** for live research with:
  - one-company input
  - research mode selector
  - `small / fast` vs `large / deep`
  - max companies to analyze
  - quick demo presets
- a separate **How it works** page for methodology and Bright Data routing
- a toggle-based **results interface** with:
  - executive or investor summary
  - comparison & charts
  - signals & findings
  - financial detail
  - Google / SERP evidence
  - news / reviews
  - source pages
  - full markdown export
- **downloadable output** as Markdown and JSON

---

## Architecture

```text
User query
  └─ company names + research mode + depth + max competitors
      └─ research strategy selection
          ├─ Bright Data search / SERP
          ├─ competitor inference
          ├─ page discovery
          ├─ Web Unlocker scraping
          ├─ signal extraction
          └─ report synthesis
                ├─ browser UI
                ├─ markdown export
                └─ json export
```

Key files:

```text
src/
├── index.ts                    # orchestration
├── server.ts                   # web UI and download endpoints
├── brightdata.ts               # Bright Data client helpers
└── pipeline/
    ├── discover-sources.ts     # official pages discovery
    ├── enrich-market.ts        # SERP, finance hints, competitor inference
    ├── extract-signals.ts      # signal extraction
    ├── research-strategy.ts    # mode-based routing
    └── synthesize-report.ts    # final report
```

---

## Best demo flows

The strongest demo cases right now are:

1. `Notion` in `market`
2. `Slack` in `reviews`
3. `Figma` in `social`
4. `Apple` in `financial`

These showcase the strongest parts of the platform: competitor discovery, SERP evidence, official-page scraping, and structured report generation.

---

## How to run

### Prerequisites

- Node.js `>= 20`
- Bright Data account
- Bright Data CLI authenticated locally

Recommended setup:

```bash
curl -fsSL https://cli.brightdata.com/install.sh | bash
bdata login
```

### Local app

```bash
cd /Users/epilick/Dev/birghtdata/competitor-launch-tracker
npm install
npm run start
```

Then open:

```text
http://localhost:3000
```

### Dev mode

```bash
cd /Users/epilick/Dev/birghtdata/competitor-launch-tracker
npm run dev
```

This restarts the app automatically on file changes.

### CLI demo

```bash
cd /Users/epilick/Dev/birghtdata/competitor-launch-tracker
npm run demo
```

This writes a sample report to:

```text
examples/notion-coda-clickup-report.md
```

### Custom CLI analysis

```bash
npm run analyze -- \
  --competitors "Slack" \
  --mode reviews \
  --size small \
  --max-competitors 1 \
  --output reports/slack-reviews.md
```

---

## Web app usage

In the web app you can:

- enter one company and let the app infer likely competitors
- optionally enter a competitor set directly
- choose the research mode
- choose **research depth**:
  - `small / fast` for fewer sources and quicker answers
  - `large / deep` for more coverage and slower but richer output
- choose **max companies to analyze**
- watch a live frontend loading state while the analysis runs
- start from quick presets:
  - `Apple financial`
  - `Notion market`
  - `Slack reviews`
  - `Figma social`

The result page shows:

- executive or investor summary
- comparison charts
- extracted findings with source evidence
- linked sources
- downloadable Markdown and JSON

---

## Output examples

Example report:

- [`examples/notion-coda-clickup-report.md`](examples/notion-coda-clickup-report.md)

That report includes:

- pricing and feature signals
- hiring and positioning clues
- competitor-by-competitor pages analyzed
- cross-competitor insights
- strategic recommendations

---

## What is strong today

- strong company and competitor research UX
- good Bright Data integration for:
  - SERP evidence
  - official page discovery
  - page scraping
- useful export story
- clear multi-tab result visualization

---

## Current limitations

This is already functional, but it is honest to call out current boundaries:

- finance mode is **evidence-based**, not a full market data terminal
- structured data quality depends on what the currently available Bright Data toolset exposes in this environment
- some queries work better than others depending on source freshness and SERP richness
- `large` mode can take a few minutes because it performs more discovery and scraping

In other words: this is a real working product, but some modes are stronger than others. The strongest, most reliable paths today are `market`, `reviews`, `social`, and `hiring`.

---

## Hackathon fit

This project is designed around the judging rubric:

| Criterion | Why this project scores well |
|---|---|
| Use of Bright Data (30) | Bright Data is the data collection and discovery engine, not an add-on |
| Does it work (25) | live search, live scraping, downloadable results, browser UI |
| Creativity (20) | positioned as a true company intelligence platform, not a single scraper |
| Technical execution (15) | modular TypeScript pipeline, separate UI, report generation |
| README & clarity (10) | this document explains what it does, why Bright Data matters, and how to run it |

---

## Submission checklist

- [x] Local web app
- [x] Live Bright Data integration
- [x] Downloadable output
- [x] Example report
- [x] Separate explanation page
- [x] Push final version to public GitHub repo

---

## License

MIT
