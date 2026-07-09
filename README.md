# Company Intelligence Platform

This repository contains our Bright Data hackathon submission: a live **Company Intelligence Platform** built in `competitor-launch-tracker/`.

The product turns a single company name into a research workflow:

- infer likely competitors automatically
- search the live web through Bright Data
- scrape official pages with Web Unlocker
- extract structured signals
- produce a browser report with charts, findings, and downloads

This is a real working app, not a static prototype.

## Where the app lives

- Main project: [`competitor-launch-tracker/`](competitor-launch-tracker)
- Submission README: [`competitor-launch-tracker/README.md`](competitor-launch-tracker/README.md)
- Example output: [`competitor-launch-tracker/examples/notion-coda-clickup-report.md`](competitor-launch-tracker/examples/notion-coda-clickup-report.md)

## Quick start

## Prerequisites

- Node.js `>= 20`
- Bright Data account
- Bright Data CLI installed and authenticated with `bdata login`

## Full documentation

For setup details, usage modes, Bright Data routing, and demo flows, see:
[`competitor-launch-tracker/README.md`](competitor-launch-tracker/README.md)

## Quick start

```bash
cd competitor-launch-tracker
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## What the app does

The web UI supports:

- **Market & competitors**: pricing, positioning, product pages
- **Financial & stock**: market cap, earnings, investor context
- **Reviews & reputation**: Reddit, G2, comparisons, complaints
- **Social presence**: LinkedIn, X, YouTube visibility
- **Hiring & growth**: careers pages and job listings

It also lets the user choose:

- `small / fast` vs `large / deep`
- maximum number of companies to analyze
- one company only, or multiple companies manually

## Bright Data usage

The app uses Bright Data as the core data layer:

- `bdata search` for live SERP evidence
- Web Unlocker scraping for official pages
- Bright Data pipelines when matching URLs are available
- CLI-authenticated local execution for real web-backed runs

## Notes

There are additional Bright Data reference materials and skills in this repository, but the hackathon submission itself is the app inside `competitor-launch-tracker/`.

## License

MIT
